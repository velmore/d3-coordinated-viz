//* Tory Elmore, Fall 2019
// GEOG 575 Lab 2 */

//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){

//pseudo-global variables
var attrArray = ["Percent Federal Lands", "Percent Wilderness", "Percent USFS Lands", "Percent NPS Lands", "Percent USFWS Lands", "Percent BLM Lands", "Percent Native Lands"]; //list of attributes
var expressed = attrArray[0]; //initial attribute

//chart frame dimensions
var chartWidth = window.innerWidth * 0.425,
    chartHeight = 300,
    leftPadding = 25,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

//create a scale to size bars proportionally to frame and for axis
var yScale = d3.scaleLinear()
    .range([300, 0])
    .domain([0, 100]);

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    
     //map frame dimensions
   var width = window.innerWidth * 0.5,
       height = 460;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height)
        .call(d3.zoom()
                    .scaleExtent([1,4])
                    .on("zoom", function () {
                                map.attr("transform", d3.event.transform);
                    }))
            .append("g");

    //create Albers equal area conic projection centered on Alaska
    var projection = d3.geoAlbers()
        .center([0, 62])
        .rotate([158, 0, 0])
        .parallels([43, 62])
        .scale(1000)
        .translate([width / 2, height / 2]);
    
    var path = d3.geoPath()
        .projection(projection);
    
    //use d3.queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.csv, "data/unitData.csv") //load attributes from csv
        .defer(d3.json, "data/State.topojson") //load background spatial data
        .defer(d3.json, "data/Counties.topojson") //load choropleth spatial data
        .await(callback);

    function callback(error, csvData, state, counties){
        //translate TopoJSON
        var state = topojson.feature(state, state.objects.State),
            counties = topojson.feature(counties, counties.objects.Counties).features;
        
        //add alaska state boundary to map
        var alaska = map.append("path")
            .datum(state)
            .attr("class", "alaska")
            .attr("d", path);
        
        //join csv data to GeoJSON enumeration units
        counties = joinData(counties, csvData);
        
        //create the color scale
        var colorScale = makeColorScale(csvData);

        //add enumeration units to the map
        setEnumerationUnits(counties, map, path, colorScale);
        
         //add coordinated visualization to the map
        setChart(csvData, colorScale);
        
        //add legend to map 
        createLegend();
        
        //add dynamic title
        dynamicTitle();
        
        // add dropdown
        createDropdown(csvData);
    };
}; //end of setMap()
    
function joinData(counties, csvData){

    //loop through csv to assign each set of csv attribute values to geojson county
    for (var i=0; i<csvData.length; i++){
        var csvCounty = csvData[i]; //the current county
        var csvKey = csvCounty.COUNTYFPS; //the CSV primary key

        //loop through geojson counties to find correct county
        for (var a=0; a<counties.length; a++){

            var geojsonProps = counties[a].properties; //the current county geojson properties
            var geojsonKey = geojsonProps.COUNTYFPS; //the geojson primary key

            //where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){

                //assign all attributes and values
                attrArray.forEach(function(attr){
                    var val = parseFloat(csvCounty[attr]); //get csv attribute value
                    geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    
                    console.log(counties);
                    
                });
            };
        };
    };

    return counties;
};

function setEnumerationUnits(counties, map, path, colorScale){
    //add alaska counties to map
    var alaskaCounties = map.selectAll(".alaskaCounties")
        .data(counties)
        .enter()
        .append("path")
        .attr("class", function(d){
             return "alaskaCounties " + d.properties.COUNTYFPS;
            })
         .attr("d", path)
         .style("fill", function(d){
            return choropleth(d.properties, colorScale);
        })
        .on("mouseover", function(d){
            highlight(d.properties);
        })
        .on("mouseout", function(d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);
    
    var desc = alaskaCounties.append("desc")
        .text('{"stroke": "#FFF", "stroke-width": "0.5px"}');
};

//function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#A9D4E5",
        "#A0C6DC",
        "#97B8D4",
        "#8EAACB",
        "#859BC2",
        "#7C8DBA",
        "#737FB1",
        "#6A71A8",
        "#6162A0",
        "#585497"
    ];

   //create color scale generator
    var colorScale = d3.scaleQuantile()
        .range(colorClasses);

    //build two-value array of minimum and maximum expressed attribute values
    var minmax = [
        d3.min(data, function(d) { return parseFloat(d[expressed]); }),
        d3.max(data, function(d) { return parseFloat(d[expressed]); })
    ];
    //assign two-value array as scale domain
    colorScale.domain(minmax);

    return colorScale;
};
    
//function to test for data value and return color
function choropleth(props, colorScale){
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //if attribute value exists, assign a color; otherwise assign gray
    if (typeof val == 'number' && !isNaN(val)){
        return colorScale(val);
    } else {
        return "#CCC";
    };
};
    
//function to create coordinated bar chart
function setChart(csvData, colorScale){

    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");
    
    //create a rectangle for chart background fill
    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);
    
    //set bars for each province
     var bars = chart.selectAll(".bar")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){
            return "bar " + d.COUNTYFPS;
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        .on("mouseover", highlight)
        .on("mouseout", dehighlight)
        .on("mousemove", moveLabel);
    
    var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');
    
    //create vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale);

    //place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);

    //create frame for chart border
    var chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);
    
    //set bar positions, heights, and colors
    updateChart(bars, csvData.length, colorScale);
}; //end of setChart()
    
    //function to create a dropdown menu for attribute selection
function createDropdown(csvData){
    //add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData)
        });
    
    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return d });
};
    
    //dropdown change listener handler
function changeAttribute(attribute, csvData){
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
    var alaskaCounties = d3.selectAll(".alaskaCounties")
        .transition()
        .duration(1000)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale)
        });

    //re-sort, resize, and recolor bars
    var bars = d3.selectAll(".bar")
        //re-sort bars
        .sort(function(a, b){
            return b[expressed] - a[expressed];
        })
        .transition() //add animation
        .delay(function(d, i){
            return i * 20
        })
        .duration(500);

    updateChart(bars, csvData.length, colorScale);
}; //end of changeAttribute()
    
    //function to position, size, and color bars in chart
function updateChart(bars, n, colorScale){
    //position bars
    bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        //size/resize bars
        .attr("height", function(d, i){
            return 463 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        //color/recolor bars
        .style("fill", function(d){
            return choropleth(d, colorScale);
        });
     //at the bottom of updateChart()...add text to chart title
    var chartTitle = d3.select(".chartTitle")
        .text(expressed + " in Alaska Census Regions");
};
     //function to highlight enumeration units and bars
function highlight(props){
    //change stroke
    var selected = d3.selectAll("." + props.COUNTYFPS)
        .style("stroke", "white")
        .style("stroke-width", "2");
        
    
    setLabel(props);
};

function dehighlight(props){
    var selected = d3.selectAll("." + props.COUNTYFPS)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
     d3.select(".infolabel")
        .remove();
};
    
//function to create dynamic label
function setLabel(props){
    //label content
    var labelAttribute = "<h1>" + props[expressed] +
        "</h1><b>" + expressed + "</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.COUNTYFPS + "_label")
        .html(labelAttribute);

    var regionName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.name);
};

//function to move info label with mouse
function moveLabel(){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = d3.event.clientX + 10,
        y1 = d3.event.clientY - 75,
        x2 = d3.event.clientX - labelWidth - 10,
        y2 = d3.event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = d3.event.clientY < 75 ? y2 : y1; 

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};

function createLegend(){
    var legend = d3.select("body")
                .append("svg")
                .attr("class", "legend")
                .attr("width", 100)
                .attr("height", 200)
    
        legend.append("circle")
              .attr("cx", 10)
              .attr("cy", 10)
              .attr("r", 6)
              .style("fill", "#A9D4E5")      
        legend.append("text")
              .attr("x", 30)
              .attr("y", 12)
              .text("0-10%")
              .style("font-size", "15px")
              .attr("alignment-baseline","middle")
    
        legend.append("circle")
              .attr("cx", 10)
              .attr("cy", 30)
              .attr("r", 6)
              .style("fill", "#A0C6DC")
        legend.append("text")
              .attr("x", 30)
              .attr("y", 32)
              .text("10-20%")
              .style("font-size", "15px")
              .attr("alignment-baseline","middle")
    
        legend.append("circle")
              .attr("cx", 10)
              .attr("cy", 50)
              .attr("r", 6)
              .style("fill", "#97B8D4")
        legend.append("text")
              .attr("x", 30)
              .attr("y", 52)
              .text("20-30%")
              .style("font-size", "15px")
              .attr("alignment-baseline","middle")
    
        legend.append("circle")
              .attr("cx", 10)
              .attr("cy", 70)
              .attr("r", 6)
              .style("fill", "#8EAACB")
        legend.append("text")
              .attr("x", 30)
              .attr("y", 72)
              .text("30-40%")
              .style("font-size", "15px")
              .attr("alignment-baseline","middle")
    
        legend.append("circle")
              .attr("cx", 10)
              .attr("cy", 90)
              .attr("r", 6)
              .style("fill", "#859BC2")
        legend.append("text")
              .attr("x", 30)
              .attr("y", 92)
              .text("40-50%")
              .style("font-size", "15px")
              .attr("alignment-baseline","middle")
    
        legend.append("circle")
              .attr("cx", 10)
              .attr("cy", 110)
              .attr("r", 6)
              .style("fill", "#7C8DBA")
        legend.append("text")
              .attr("x", 30)
              .attr("y", 113)
              .text("50-60%")
              .style("font-size", "15px")
              .attr("alignment-baseline","middle")
    
        legend.append("circle")
              .attr("cx", 10)
              .attr("cy", 130)
              .attr("r", 6)
              .style("fill", "#737FB1")
        legend.append("text")
              .attr("x", 30)
              .attr("y", 132)
              .text("60-70%")
              .style("font-size", "15px")
              .attr("alignment-baseline","middle")
    
        legend.append("circle")
              .attr("cx", 10)
              .attr("cy", 150)
              .attr("r", 6)
              .style("fill", "#6A71A8")
        legend.append("text")
              .attr("x", 30)
              .attr("y", 152)
              .text("70-80%")
              .style("font-size", "15px")
              .attr("alignment-baseline","middle")
    
        legend.append("circle")
              .attr("cx", 10)
              .attr("cy", 170)
              .attr("r", 6)
              .style("fill", "#6162A0")
        legend.append("text")
              .attr("x", 30)
              .attr("y", 172)
              .text("80-90%")
              .style("font-size", "15px")
              .attr("alignment-baseline","middle")
    
        legend.append("circle")
              .attr("cx", 10)
              .attr("cy", 190)
              .attr("r", 6)
              .style("fill", "#585497")
        legend.append("text")
              .attr("x", 30)
              .attr("y", 192)
              .text("90-100%")
              .style("font-size", "15px")
              .attr("alignment-baseline","middle")
};
    
function dynamicTitle(){
       var title = d3.select("body")
                .append("svg")
                .attr("class", "title")
                .attr("width", 500)
                .attr("height", 50)
      var chartTitle = title.append("text")
        .attr("x", 40)
        .attr("y", 20)
        .attr("class", "chartTitle")
        .text(expressed + " in Alaska Census Areas")
    
};
    
})(); //last line of main.js