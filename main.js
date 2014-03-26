(function () {
  "use strict";

  d3.json('medians.json', function (medians) {
    d3.json('data.json', function (inputData) {
      var margin = {top: 10, right: 10, bottom: 10, left: 10},
          outerWidth = 200,
          outerHeight = 200,
          width = outerWidth - margin.left - margin.right,
          height = outerHeight - margin.top - margin.bottom,
          dist = 2;
      inputData.nodes.forEach(function (data) {
        data.x = window.spider[data.id][0];
        data.y = window.spider[data.id][1];
      });
      inputData.links.forEach(function (link) {
        link.source = inputData.nodes[link.source];
        link.target = inputData.nodes[link.target];
      });
      var xRange = d3.extent(inputData.nodes, function (d) { return d.x; });
      var yRange = d3.extent(inputData.nodes, function (d) { return d.y; });
      var xScale = width / (xRange[1] - xRange[0]);
      var yScale = height / (yRange[1] - yRange[0]);
      var scale = Math.min(xScale, yScale);
      inputData.nodes.forEach(function (data) {
        data.pos = [data.x * scale, data.y * scale];
      });
      function draw () {
        var svg = d3.select('body').append('svg')
            .attr('width', outerWidth)
            .attr('height', outerHeight)
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

        function place(selection) {
          selection
            .attr('x1', function (d) { return d.source.pos[0]; })
            .attr('y1', function (d) { return d.source.pos[1]; })
            .attr('x2', function (d) { return d.target.pos[0]; })
            .attr('y2', function (d) { return d.target.pos[1]; });
        }

        lines.append('line')
            .attr('class', 'main')
            .call(place)
            .style('stroke', function (d) { return d.color; });

        var dir1 = lines.append('g')
            .attr('class', function (d) { return d.line + ' ' + d.source.id + '-' + d.target.id; })
          .append('line')
            .call(place);

        var dir2 = lines.append('g')
            .attr('class', function (d) { return d.line + ' ' + d.target.id + '-' + d.source.id; })
          .append('line')
            .call(place);

        // line color circles
        svg.append('circle')
          .attr('cx', scale * 8.48)
          .attr('cy', scale * 0)
          .attr('fill', "#E87200")
          .attr('r', 3)
          .attr('stroke', "none");
        svg.append('circle')
          .attr('cx', scale * 14.38)
          .attr('cy', scale * 2.5)
          .attr('fill', "#2F5DA6")
          .attr('r', 3)
          .attr('stroke', "none");
        svg.append('circle')
          .attr('cx', scale * 1)
          .attr('cy', scale * 3.18)
          .attr('fill', "#E12D27")
          .attr('r', 3)
          .attr('stroke', "none");
        return svg;
      }

      function offset(dist, dir, speed) {
        return function (selection) {
          selection.attr('transform', function (d) {
            var angle = Math.atan2(d.target.pos[1] - d.source.pos[1], d.target.pos[0] - d.source.pos[0]);
            var x = (dist / 2) * Math.cos(angle + dir * Math.PI / 2);
            var y = (dist / 2) * Math.sin(angle + dir * Math.PI / 2);
            return 'translate(' + x + ', ' + y + ')';
          }).style('stroke-width', dist)
          .attr('class', function (d) {
            if (speed === null) {
              return "nodata";
            } else if (speed > 0.75) {
              return "ok"
            } else if (speed > 0.5) {
              return "slowing";
            } else if (speed > 0.25) {
              return "slow";
            } else {
              return "stopped";
            }
          });
        };
      }

      var svg = draw();
      function poll() {
        ['red', 'blue', 'orange'].forEach(function (line) {
          d3.jsonp('http://jsonpwrapper.com/?urls%5B%5D=http%3A%2F%2Fdeveloper.mbta.com%2Flib%2Frthr%2F' + line + '.json&callback={callback}', function (data) {
            var byPair = {};
            var body = JSON.parse(data[0].body);
            // console.log(JSON.stringify(body, null, 2));
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

            function update(FROM, TO, dir) {
              var key = FROM + "|" + TO;
              if (byPair.hasOwnProperty(key)) {
                var diff = average(byPair[key]);
                var median = medians[key];
                var speed = median / diff;
                svg.selectAll('.' + line + '.' + FROM + '-' + TO + ' line')
                  .call(offset(2, dir, speed));
              } else {
                svg.selectAll('.' + line + '.' + FROM + '-' + TO + ' line')
                  .call(offset(2, dir, null));
              }
            }

            inputData.links.forEach(function (link) {
              update(link.source.id, link.target.id, -1);
              update(link.target.id, link.source.id, 1);
            });
          });
        });
        setTimeout(poll, 15000);
      }
      poll();
    });
  });

  function average(list) {
    return list.reduce(function (a,b) { return a+b; }) / list.length;
  }
}());