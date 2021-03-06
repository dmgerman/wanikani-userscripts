/* jshint esversion: 6 */

// Zoom code (v3!)
// http://bl.ocks.org/nicolashery/9627333

(function()
{
    "use strict";

    var margin = {top: 10, right: 10, bottom: 32, left: 40};
    var height = 162 - margin.top - margin.bottom;
    var barWidth = 10;
    var maxBars = 1000;
    var scrollableWidth = maxBars*barWidth;
    var maxTime = 20;

    var xScale = d3.scaleLinear().domain([0, maxBars]).range([0, scrollableWidth]);
    var yScale = d3.scaleLinear().domain([0, maxTime]).rangeRound([height, 0]);

    var xAxis = d3.axisBottom(xScale);
    var yAxis = d3.axisLeft(yScale).ticks(3);

    var start_index = 0;
    var last_index = 0;

    // Tooltip code: http://bl.ocks.org/Caged/6476579
    // #####################################################################
    var tip = d3.tip()
            .attr('class', `${GM_info.script.namespace} d3-tip`)
            .offset([-14, 0])
            .html(function(d) {
                var answer;

                if (d.qtype ===`meaning`)
                    answer = d.item.en[0]; //.join(`, `);
                else
                {
                    if (d.type === `voc`)
                        answer = d.item.kana.join(`・`);
                    else if (d.type === `kan`)
                    {
                        if (d.item.emph === `onyomi`)
                            answer = d.item.on.join(`・`);
                        else
                            answer = d.item.kun.join(`・`);
                    }
                }
                return `
                    <table>
                        <tbody>
                           <tr><td>Q?</td><td>${d.item.rad||d.item.kan||d.item.voc}</td></tr>
                           <tr><td>A!</td><td>${answer}</td></tr>
                           <tr><td>TX</td><td><span style='color:red'>${d.time}&thinsp;s</span></td></tr>
                        </tbody>
                    </table>
                `;
            });
    // #####################################################################


    var svg;
    var scrollable;
    var zoom;

    // #####################################################################
    function updateScales(start, end)
    {
        xScale.domain([start, end]);
    }
    // #####################################################################

    // #####################################################################
    function drawAxis(sessions)
    {
        xAxis
            .tickValues(sessions.map((d)=>d.start_index))
            .tickFormat( function(d,i) {
                var format = d3.timeFormat(`%Y-%m-%d`);

                if (sessions[i].answer_cnt < 5 && i<sessions.length-1)
                    return `X`;
                else
                    return format(sessions[i].start_time);
            });

        svg.select('.xaxis').call(xAxis);
        svg.select('.yaxis').call(yAxis);

        // Second line of the ticks (if there is sufficient space)
        svg.select('.xaxis').selectAll(`.tick`)
            .each( function(d,i) {
                var format = d3.timeFormat("%H:%M:%S");

                if (sessions[i].answer_cnt >= 5 || i===sessions.length-1)
                    d3.select(this)
                        .append(`text`)
                            .text(format(sessions[i].start_time))
                            .attr(`y`, 28)
                            .attr(`fill`, `#000`);
            }
        );

        svg.select('.xaxis').attr(`text-anchor`, `start`);
    }
    // #####################################################################

    // #####################################################################
    function drawFill()
    {
        var g = scrollable.selectAll('g.fill-group')
            .data(['1'])
            .enter()
                .append('g')
                .attr('class', 'fill-group');

        var fill = g.selectAll('.fill').data(['1']);

        fill.enter().append('rect')
            .attr('class', 'fill')
            .attr('width', scrollableWidth)
            .attr('height', height);
    }
    // #####################################################################

    // #####################################################################
    function drawBars(data)
    {
        var g = scrollable.selectAll('g.data-bars')
            .data(['1'])
            .enter()
                .append('g')
                .attr('class', 'data-bars');

        // #####################################################################
        var data_bar = g.selectAll(".data-bar")
                        .data(data)
                        .enter().append(`g`)
                            .attr(`class`, `bar-group`)
                            .each( function(d,i) {
                                d3.select(this).selectAll(`.data-bar`)
                                    .data([d])
                                    .enter().append("rect")
                                        .attr("class", (d) => `bar answer-type ${d.type}`);
                                d3.select(this).selectAll(`.data-bar`)
                                    .data([d])
                                    .enter().append("rect")
                                        .attr("class", (d) => `bar answer-qtype ${d.qtype}`);
                                d3.select(this).selectAll(`.data-hatch`)
                                    .data([d])
                                    .enter().append("rect")
                                        .attr("class", (d) => `bar answer-hatch ${d.wasWrong?"wk_jikan_incorrect":"wk_jikan_correct"}`)
                                        .on('mouseover', tip.show)
                                        .on('mouseout', tip.hide);
                            });
        // #####################################################################

        // #####################################################################
        data_bar.selectAll(`.bar`)
                .attr("x", (d) => xScale(d.index) - 0.5)
                .attr("y", (d) => yScale(Math.min(maxTime, d.time)) - 0.5)
                .attr("width", barWidth)
                .attr("height", (d) => height - yScale(Math.min(maxTime, d.time)));

        data_bar.selectAll(".bar").exit().remove();
        // #####################################################################

        // this.svg.selectAll("rect").on("click", function(a) {
            // if (`rad` in a.item)
                // window.open(`/radicals/${a.item.rad}`, "_blank");
            // else if (`kan` in a.item)
                // window.open(`/kanji/${a.item.kan}`, "_blank");
            // else if (`voc` in a.item)
                // window.open(`/vocabulary/${a.item.voc}`, "_blank");
        // });
        // #####################################################################
    }
    // #####################################################################

    function onZoom(d)
    {
        // Rescript the scrolling to 0 left (2 bars margin) and maxBars right
        d3.event.transform.x = Math.max(-(last_index-10)*barWidth, Math.min(2.8*barWidth, d3.event.transform.x));
        d3.event.transform.y = 0;

        // create new scale ojects based on event
        var new_xScale = d3.event.transform.rescaleX(xScale);

        // update axes
        svg.select('.xaxis').call(xAxis.scale(new_xScale));

        var transform = d3.event.transform;
        scrollable.selectAll('g.data-bars').attr(`transform`, d3.event.transform);
    }

    // #########################################################################
    WK_Jikan.prototype.createSummaryChart = function(selector)
    {
        var width = $(selector).width() - margin.left - margin.right;

        var maxTime = Math.max(20, d3.quantile(this.session_db.answers.map(a=>a.time).sort((a,b) => (a-b)), 0.95) || 0);

        zoom = d3.zoom()
                    .scaleExtent([1, 1]) // Only allow translations
                    .on('zoom', onZoom);

        // #####################################################################
        svg = d3.select(selector)
                .append("svg")
                    .attr("class", "chart")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                .append("g")
                    .attr(`class`, `zoomer`)
                    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
                    // Important to listen for "zoom" events on a fixed element,
                    // else you get a jitter/shake effect
                    // http://stackoverflow.com/questions/12674872/d3-force-layout-making-pan-on-drag-zoom-smoother
                    .call(zoom);
        // #####################################################################

        svg.append('clipPath')
                .attr('id', 'clip')
            .append('rect')
                .attr('x', 0)
                // Stretch to cover x axis
                .attr('y', -margin.top)
                .attr('width', width)
                .attr('height', height + margin.bottom + margin.top);

        // #####################################################################
        svg.append(`pattern`)
                .attr(`id`, `diagonalHatch`)
                .attr(`width`, 10)
                .attr(`height`, 10)
                .attr(`patternUnits`, `userSpaceOnUse`)
            .append(`path`)
                .attr(`d`, `M-1,1 l2,-2 M0,10 l10,-10 M9,11 l2,-2`)
                .attr(`style`, `stroke: red; stroke-width: 3;`);
        // #####################################################################

        // #####################################################################
        svg.append(`pattern`)
                .attr(`id`, `dotted`)
                .attr(`width`, 2)
                .attr(`height`, 2)
                .attr(`patternUnits`, `userSpaceOnUse`)
            .append(`circle`)
                .attr(`cx`, 1)
                .attr(`cy`, 1)
                .attr(`r`, 0.6)
                .attr(`style`, `fill: white; fill-opacity: 0.6;`);
        // #####################################################################

        svg
        .append('g')
            .attr('class', 'yaxis')
            .attr('transform', 'translate(0,0)');

        var scrollableViewBox = svg
                                .append('g')
                                    .attr('clip-path', 'url(#clip)');

        scrollable = scrollableViewBox
                            .append('g')
                                .attr('width', scrollableWidth)
                                .attr('class', 'scrollable');
        scrollable
            .append('g')
                .attr('class', 'xaxis')
                .attr('transform', `translate(0, ${height})`);

        svg.call(tip);

        $(window).resize(this.resizeSummaryChart.bind(this));
        // #####################################################################
    };
    // #########################################################################

    WK_Jikan.prototype.resizeSummaryChart = function()
    {
        var width = $(`#jikan_session_chart`).width() - margin.left - margin.right;

        d3.select(`.chart`).attr(`width`, width + margin.left + margin.right);
        d3.select(`#clip`).selectAll(`rect`).attr(`width`, width);
    };

    // #########################################################################
    WK_Jikan.prototype.drawSummaryChart = function()
    {
        var answer_cnt = this.session_db.sessions.slice(-1)[0].answer_cnt;
        start_index = this.session_db.sessions.slice(-1)[0].start_index;
        last_index = start_index + answer_cnt;

        // We only want to displan maxBars in the zoom, clip older data
        if (last_index > maxBars)
        {
            updateScales(last_index-maxBars, last_index);

            // update indices
            start_index -= last_index-maxBars;
            last_index = maxBars;
        }
        else
            updateScales(0, maxBars);

        drawAxis(this.session_db.sessions);
        drawFill();
        drawBars(this.session_db.answers);

        // Automatically scroll to the last session
        svg.call(zoom.transform, d3.zoomIdentity.translate((2.8-start_index)*barWidth, 0));
    };
    // #########################################################################
}
)();
// #############################################################################
