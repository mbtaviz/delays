(function () {
  "use strict";
  var margin = {top: 10, right: 10, bottom: 10, left: 10},
      dist = 5,
      endDotRadius = 8,
      cache = {},
      idToLine = {};

  d3.json('medians.json', function (medians) {
    d3.json('data.json', function (inputData) {
      inputData.nodes.forEach(function (data) {
        data.x = window.spider[data.id][0];
        data.y = window.spider[data.id][1];
      });
      inputData.links.forEach(function (link) {
        link.source = inputData.nodes[link.source];
        link.target = inputData.nodes[link.target];
        link.source.links = link.source.links || [];
        link.target.links = link.target.links || [];
        link.target.links.splice(0, 0, link);
        link.source.links.splice(0, 0, link);
        idToLine[link.source.id + '|' + link.target.id] = link.line;
        idToLine[link.target.id + '|' + link.source.id] = link.line;
      });
      var xRange = d3.extent(inputData.nodes, function (d) { return d.x; });
      var yRange = d3.extent(inputData.nodes, function (d) { return d.y; });

      var svg;
      function draw () {
        var m = Math.min(window.innerWidth || 300, window.innerHeight || 300) / 20;
        margin = {
          top: m,
          right: m,
          bottom: m,
          left: m
        };
        var outerWidth = (window.innerWidth || 300) - 10,
            outerHeight = (window.innerHeight || 300) - 10,
            width = outerWidth - margin.left - margin.right,
            height = outerHeight - margin.top - margin.bottom;
        var xScale = width / (xRange[1] - xRange[0]);
        var yScale = height / (yRange[1] - yRange[0]);
        var scale = Math.min(xScale, yScale);
        dist = 0.25 * scale;
        endDotRadius = 0.35 * scale;
        inputData.nodes.forEach(function (data) {
          data.pos = [data.x * scale, data.y * scale];
        });
        d3.select('svg').remove();
        svg = d3.select('body').append('svg')
            .attr('width', scale * xRange[1] + margin.left + margin.right)
            .attr('height', scale * yRange[1] + margin.top + margin.bottom)
          .append('g')
            .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        svg.selectAll('.station')
            .data(inputData.nodes)
            .enter()
          .append('circle')
            .attr('class', function (d) { return 'station ' + d.id; })
            .attr('cx', function (d) { return d.pos[0]; })
            .attr('cy', function (d) { return d.pos[1]; })
            .attr('r', 0);
        var lines = svg.selectAll('.connect')
            .data(inputData.links)
            .enter()
          .append('g')
            .attr('attr', 'connect');

        lines.append('g')
            .attr('class', function (d) { return d.line + ' ' + d.source.id + '-' + d.target.id; })
          .append('path')
            .datum(function (d) {
              return {
                incoming: getEntering(d.source),
                line: d.line,
                ids: d.source.id + '|' + d.target.id,
                segment: [d.source.pos, d.target.pos],
                outgoing: getLeaving(d.target)
              };
            })
            .attr('class', classFunc)
            .attr('d', lineFunction);

        lines.append('g')
            .attr('class', function (d) { return d.line + ' ' + d.target.id + '-' + d.source.id; })
          .append('path')
            .datum(function (d) {
              return {
                incoming: getEntering(d.target),
                line: d.line,
                ids: d.target.id + '|' + d.source.id,
                segment: [d.target.pos, d.source.pos],
                outgoing: getLeaving(d.source)
              };
            })
            .attr('class', classFunc)
            .attr('d', lineFunction);

        function getEntering(node) {
          return node.links.map(function (n) {
            var segment;
            if (n.target === node) {
              segment = [n.source.pos, n.target.pos];
            } else {
              segment = [n.target.pos, n.source.pos];
            }
            return {
              segment: segment,
              line: n.line
            };
          });
        }

        function getLeaving(node) {
          return node.links.map(function (n) {
            var segment;
            if (n.source === node) {
              segment = [n.source.pos, n.target.pos];
            } else {
              segment = [n.target.pos, n.source.pos];
            }
            return {
              segment: segment,
              line: n.line
            };
          });
        }

        // line color circles
        function dot(id, color) {
          svg.append('circle')
            .attr('cx', scale * window.spider[id][0])
            .attr('cy', scale * window.spider[id][1])
            .attr('fill', color)
            .attr('r', endDotRadius)
            .attr('stroke', "none");
        }
        dot('place-asmnl', "#E12D27");
        dot('place-alfcl', "#E12D27");
        dot('place-brntn', "#E12D27");
        dot('place-wondl', "#2F5DA6");
        dot('place-bomnl', "#2F5DA6");
        dot('place-forhl', "#E87200");
        dot('place-ogmnl', "#E87200");
        return svg;
      }

      function offset(selection) {
        selection
          .attr('d', lineFunction)
          .attr('class', classFunc);
      }

      function classFunc(d) {
        var speed = cache[d.ids];
        var cls;
        if (speed === null || typeof speed === 'undefined') {
          cls = "nodata";
        } else if (speed > 0.75) {
          cls = "ok";
        } else if (speed > 0.5) {
          cls = "slowing";
        } else if (speed > 0.25) {
          cls = "slow";
        } else {
          cls = "stopped";
        }
        return cls;
      }

      draw();
      d3.select(window).on('resize', draw);
      function poll() {
        ['red', 'blue', 'orange'].forEach(function (line) {
          d3.jsonp('http://jsonpwrapper.com/?urls%5B%5D=http%3A%2F%2Fdeveloper.mbta.com%2Flib%2Frthr%2F' + line + '.json&callback={callback}', function (data) {
            var byPair = {};
            var body = JSON.parse(data[0].body);
            body.TripList.Trips.forEach(function (trip) {
              var last = null;
              var lastStopId = null;
              trip.Predictions.forEach(function (prediction) {
                var stopId = inputData.parentStops[prediction.StopID];
                var p = +prediction.Seconds;
                if (last) {
                  byPair[lastStopId + "|" + stopId] = byPair[lastStopId + "|" + stopId] || [];
                  byPair[lastStopId + "|" + stopId].push(p - last);
                }
                lastStopId = stopId;
                last = p;
              });
            });

            function update(FROM, TO) {
              var key = FROM + "|" + TO;
              if (byPair.hasOwnProperty(key)) {
                var diff = d3.max(byPair[key]);
                var median = medians[key];
                var speed = median / diff;
                cache[key] = speed;
              } else if (line === idToLine[key]) {
                cache[key] = null;
              }
            }
            inputData.links.forEach(function (link) {
              update(link.source.id, link.target.id);
              update(link.target.id, link.source.id);
            });
            svg.selectAll('path').call(offset);
          });
        });
        setTimeout(poll, 15000);
      }
      poll();
    });
  });

  function closestClockwise(line, lines) {
    var origAngle = angle(line.segment);
    lines = lines || [];
    var result = null;
    var minAngle = Infinity;
    lines.forEach(function (other) {
      if (same(other, line)) { return; }
      var thisAngle = angle(other.segment) + Math.PI;
      var diff = -normalize(thisAngle - origAngle);
      if (diff < minAngle) {
        minAngle = diff;
        result = other;
      }
    });
    return result;
  }
  function closestCounterClockwise(line, lines) {
    var origAngle = angle(line.segment);
    lines = lines || [];
    var result = null;
    var minAngle = Infinity;
    lines.forEach(function (other) {
      var thisAngle = angle(other.segment);
      var diff = normalize(origAngle - thisAngle);
      var absDiff = Math.abs(diff);
      if (absDiff < 0.2 || Math.abs(absDiff - Math.PI) < 0.2) { return; }
      if (diff < minAngle) {
        minAngle = diff;
        result = other;
      }
    });
    return result;
  }

  function same(a, b) {
    var sega = JSON.stringify(a.segment);
    var segb = JSON.stringify(b.segment);
    return sega === segb;
  }

  function normalize(angle) {
    return (Math.PI * 4 + angle) % (Math.PI * 2) - Math.PI;
  }

  function angle(p1, p2) {
    if (arguments.length === 1) {
      var origP1 = p1;
      p1 = origP1[0];
      p2 = origP1[1];
    }
    return Math.atan2((p2[1] - p1[1]), (p2[0] - p1[0]));
  }
  function offsetPoints(d) {
    var p1 = d.segment[0];
    var p2 = d.segment[1];
    var lineAngle = angle(p1, p2);
    var angle90 = lineAngle + Math.PI / 2;
    var p3 = [p2[0] + dist * Math.cos(angle90), p2[1] + dist * Math.sin(angle90)];
    var p4 = [p1[0] + dist * Math.cos(angle90), p1[1] + dist * Math.sin(angle90)];
    return [p4, p3];
  }
  function slope(line) {
    return (line[1][1] - line[0][1]) / (line[1][0] - line[0][0]);
  }
  function intercept(line) {
    // y = mx + b
    // b = y - mx
    return line[1][1] - slope(line) * line[1][0];
  }
  function intersect(line1, line2) {
    var m1 = slope(line1);
    var b1 = intercept(line1);
    var m2 = slope(line2);
    var b2 = intercept(line2);
    var m1Infinite = m1 === Infinity || m1 === -Infinity;
    var m2Infinite = m2 === Infinity || m2 === -Infinity;
    var x, y;
    if ((m1Infinite && m2Infinite) || Math.abs(m2 - m1) < 0.01) {
      return null;
    } else if (m1Infinite) {
      x = line1[0][0];
      // y = mx + b
      y = m2 * x + b2;
      return [x, y];
    } else if (m2Infinite) {
      x = line2[0][0];
      y = m1 * x + b1;
      return [x, y];
    } else {
      // return null;
      // x = (b2 - b1) / (m1 - m2)
      x = (b2 - b1) / (m1 - m2);
      y = m1 * x + b1;
      return [x, y];
    }
  }
  function length (a, b) {
    return Math.sqrt(Math.pow(b[1] - a[1], 2) + Math.pow(b[0] - a[0], 2));
  }
  function lineFunction (d) {
    var p1 = d.segment[0];
    var p2 = d.segment[1];
    var offsets = offsetPoints(d);
    var p3 = offsets[1];
    var p4 = offsets[0];
    var first;

    first = closestClockwise(d, d.outgoing);
    if (first) {
      var outgoingPoints = offsetPoints(first);
      var newP3 = intersect(offsets, outgoingPoints);
      if (newP3) { p3 = newP3; }
    }
    first = closestCounterClockwise(d, d.incoming);
    if (first) {
      var incomingPoints = offsetPoints(first);
      var newP4 = intersect(offsets, incomingPoints);
      if (newP4) { p4 = newP4; }
    }

    return lineMapping([p1, p2, p3, p4, p1]);
  }
  function place(selection) {
    selection
      .append('path')
      .attr('class', 'nodata')
      .attr('d', lineFunction);
  }

  var lineMapping = d3.svg.line()
    .x(function(d) { return d[0]; })
    .y(function(d) { return d[1]; })
    .interpolate("linear");

  function average(list) {
    return list.reduce(function (a,b) { return a+b; }) / list.length;
  }
}());