(function () {
  "use strict";

  d3.json('medians.json', function (medians) {
    d3.json('data.json', function (inputData) {
      var margin = {top: 10, right: 10, bottom: 10, left: 10},
          outerWidth = 300,
          outerHeight = 300,
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
          .attr('r', 1);
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

      function offset(dist, dir) {
        return function (selection) {
          selection.attr('transform', function (d) {
            var angle = Math.atan2(d.target.pos[1] - d.source.pos[1], d.target.pos[0] - d.source.pos[0]);
            var x = (1 + dist) * Math.cos(angle + dir * Math.PI / 2);
            var y = (1 + dist) * Math.sin(angle + dir * Math.PI / 2);
            return 'translate(' + x + ', ' + y + ')';
          }).style('stroke-width', dist * 2);
        };
      }

      lines.append('line')
          .attr('class', 'main')
          .call(place)
          .style('stroke', function (d) { return d.color; });

      var dir1 = lines.append('line')
          .attr('class', function (d) { return d.line + ' ' + d.source.id + '-' + d.target.id; })
          .call(place)
          .style('stroke-opacity', 0)
          .style('stroke', "black");

      var dir2 = lines.append('line')
          .attr('class', function (d) { return d.line + ' ' + d.target.id + '-' + d.source.id; })
          .call(place)
          .style('stroke-opacity', 0)
          .style('stroke', "black");

      // var scale = d3.scale.quantize()
      //   .domain([  1,      0.8,      0.5, 0.25, 0])
      //   .range(["none", "none", "yellow", "orange", "red", "black"]);
      var scale = d3.scale.linear().domain([1, 0]).range([0, 4]).clamp(true);
      function poll() {
        ['red', 'blue', 'orange'].forEach(function (line) {
          d3.jsonp('http://jsonpwrapper.com/?urls%5B%5D=http%3A%2F%2Fdeveloper.mbta.com%2Flib%2Frthr%2F' + line + '.json&callback={callback}', function (data) {
            var byStop = {};
            var body = JSON.parse(data[0].body);
            body.TripList.Trips.forEach(function (trip) {
              trip.Predictions.forEach(function (prediction) {
                var stopId = inputData.parentStops[prediction.StopID];
                byStop[stopId] = +prediction.Seconds;
              });
            });

            function update(FROM, TO, dir) {
              if (byStop.hasOwnProperty(FROM) &&
                  byStop.hasOwnProperty(TO) &&
                  byStop[TO] > byStop[FROM]) {
                var diff = byStop[TO] - byStop[FROM];
                var median = medians[FROM + '|' + TO];
                var speed = median / diff;
                svg.selectAll('.' + line + '.' + FROM + '-' + TO)
                  .call(offset(scale(speed), dir))
                  .style('stroke-opacity', 1);
              } else {
                svg.selectAll('.' + line + '.' + FROM + '-' + TO)
                  .call(offset(scale(1), dir))
                  .style('stroke-opacity', 0);
              }
            }

            inputData.links.forEach(function (link) {
              update(link.source.id, link.target.id, -1);
              update(link.target.id, link.source.id, 1);
            });
          });
        });
        setTimeout(poll, 60000);
      }
      poll();
    });
  });
}());