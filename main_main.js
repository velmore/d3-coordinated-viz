//* Tory Elmore, Fall 2019
// GEOG 575 Lab 2 */

//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){

//pseudo-global variables
var attrArray = ["popdens", "federal", "wilderness", "usfs", "nps", "usfws", "native", "blm"]; //list of attributes
var expressed = attrArray[0]; //initial attribute

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    
     //map frame dimensions
    var width = 960,
        height = 460;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on Alaska
    var projection = d3.geoAlbers()
        .center([0, 62.5])
        .rotate([153, 0, 0])
        .parallels([43, 62])
        .scale(1000)
        .translate([width / 2, height / 2]);
    
    var path = d3.geoPath()
        .projection(projection);
    
    //use d3.queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.csv, "data/unitsData.csv") //load attributes from csv
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

        //add enumeration units to the map
        setEnumerationUnits(counties, map, path);
    };
}; //end of setMap()
    
function joinData(franceRegions, csvData){

    //loop through csv to assign each set of csv attribute values to geojson region
    for (var i=0; i<csvData.length; i++){
        var csvRegion = csvData[i]; //the current region
        var csvKey = csvRegion.fips; //the CSV primary key

        //loop through geojson regions to find correct region
        for (var a=0; a<counties.length; a++){

            var geojsonProps = counties[a].properties; //the current county geojson properties
            var geojsonKey = geojsonProps.COUNTYFP; //the geojson primary key

            //where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){

                //assign all attributes and values
                attrArray.forEach(function(attr){
                    var val = parseFloat(csvRegion[attr]); //get csv attribute value
                    geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    
                    console.log(counties);
                    
                });
            };
        };
    };

    return counties;
};

function setEnumerationUnits(counties, map, path){
    //add counties to map
    var alaskaCounties = map.selectAll(".alaskaCounties")
        .data(counties)
        .enter()
        .append("path")
        .attr("class", function(d){
             return "alaskaCounties " + d.properties.COUNTYFP;
            })
         .attr("d", path);
};
        
        
})(); //last line of main.js