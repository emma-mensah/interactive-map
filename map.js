/*	
	// Legacy libraries list:
	<script src="https://d3js.org/topojson.v1.min.js"></script>
	<script src="https://d3js.org/d3-geo-projection.v2.min.js"></script>
	<script src = "https://d3js.org/d3-array.v1.min.js"></script>
	<script src = "https://d3js.org/d3-collection.v1.min.js"></script>
	<script src = "https://d3js.org/d3-color.v1.min.js"></script>
	<script src = "https://d3js.org/d3-format.v1.min.js"></script>
	<script src = "https://d3js.org/d3-interpolate.v1.min.js"></script>
	<script src = "https://d3js.org/d3-time.v1.min.js"></script>
	<script src = "https://d3js.org/d3-time-format.v2.min.js"></script>

*/

/* FILE OBJECT TEMPLATE
	{
		"filename":"",			// location of topo-json map piece (pre-downloaded by user)
		"name":"",				// computer-safe reference name for map piece (no spaces, alphanumeric only)
		"label":"",				// human-readable name for map piece (spaces and any characters (escape quotes))
		"mrgid":"",				// numeric code used to connect map geometry to metadata
			// check GeoJSON file metadata! ALL features for a given area need *the same* mrgid (matching that provided here), or mismatched feature segments will not render
		"color":"",				// hexadecimal reference for default color for map piece
		"link":"",				// URL of search page destination for associated map area; can be absolute or relative
		"fill":boolean,			// boolean TRUE or FALSE declaring whether the map piece should be filled or transparent (used to highlight specific pieces in some displays)
		"adjustCenter":{		// declaration of how 'center' should be adjusted for the purposes of placing a handle on the map piece (use value of 0 for natural centroid placement)
			"standard":[cx,cy],		// numeric adjustment values for a map centered on 0 degrees longitude
			"rotate":[cx,cy]		// adjustment values for a map centered on 180 degrees longitude
		}
			// decimal values between -100 and 100
			// these are a numeric expression of 'percent of canvas size', i.e. 90 = move 90% of canvas width right; -4.3 = move 4.3% of canvas height up
			// allows adjustment to account for different sizes, rather than needing to be instance-specific
			// no checks prevent adjustments that move handle outside of viewport; reduce value if handle seems to not render	
	}
*/

// Parameters:
	// id = DOM target of map
	// data = array of file objects (see above)
	// options = object holding variables to manipulate map rendering
		// width: integer - the width of the canvas (not necessarily of the contents thereof!) to be rendered; default = 500
		// height: integer - the height of the canvas (not necessarily of the contents thereof!) to be rendered; default = 2/3 width (333 if width is also default)
		// handles: boolean - whether to render circular 'handle' points on each map piece (see adjustCenter notes in file object description); default = false 
		// rotate: boolean - whether to render the left edge of the map as being 180 degrees longitude (false) or as 0 degrees latitude (true); default = false
// Actions:
	// Clears any existing svg (prepares it to adjust to other changes on page, like redrawing at a new width on page size adjustment)
	// Builds and attaches a new svg to spec
	// Requests a collection of ready-to-go map data
	// Extracts the map data from the collection into a FeatureCollection (allows analysis for sizing)
	// Builds projection based on needed space and provided specs (e.g. rotation)
	// Builds and attaches two groups parsed through the projection:
		// Group of map paths
		// Group of circle handles (centered on path 'centroid' but adjusted via metadata)
buildMap = function(id,data,options){
	d3.select("svg").remove();
	if(!options.width){ options.width = 500; }
	if(!options.height){ options.height = 2/3 * options.width; }
	var svg = d3.select("#" + id).append("svg").attr("class","mapCanvas").attr("width",options.width).attr("height",options.height);

	buildCollection(data).then(function(collection){
		var pg = svg.append("g");
		if(options.handles){ var hg = svg.append("g"); }
		
		var featureCollection = {type:"FeatureCollection","features":[]}
		for(var i = 0; i < collection.length; i++){
			for(var j = 0; j < collection[i].features.length; j++){
				featureCollection.features.push(collection[i].features[j]);
			}
		}
		var projection = d3.geoEquirectangular().fitSize([options.width,options.height],featureCollection);
		if(options.rotate){ projection.rotate([180,0,0]); }
		var path = d3.geoPath().projection(projection);
		
		Promise.all([attachPaths(pg,path,options,data,featureCollection)]).then(attachHandles(hg,pg.selectAll("path"),path,options,data));
	});
	
	
}

// Takes an array of data objects including a filename of JSON map data
// Parses the JSON out of each file into an array and returns it ready to use
buildCollection = function(data){
	var promises = [];
	var allMapData = [];

	data.forEach(function(file) {
		  promises.push(d3.json(file.filename))
	});

	return Promise.all(promises).then(function(mapData){
		for(var i = 0; i < mapData.length; i++){
			allMapData.push(mapData[i]);
		}
		
		return allMapData;
	});
}

// Builds and attaches map paths to a provided group
attachPaths = async function(g,path,options,data,fc){
	for(var i = 0; i < fc.features.length; i++){
		var metadata = data.find(el => el.mrgid == fc.features[i].properties.mrgid);
			
		var color = metadata.color;
		if(options.highlight){ color = options.highlightColor ? options.highlightColor : "#FFFFFF"; }
		if(options.scale){
		/*
			var domain = [100000000, 500000000]
			var range = ["#88AED0","#BF76AF","#77a361"]
			var colorScale = d3.scaleThreshold()
								.domain(domain)
								.range(range);
			var color = colorScale(metadata.value);		//value does not exist yet and would need to be added from a stat
		*/
		}
		
		g.append("path")
			.datum(fc.features[i])
			.attr("d",path)
			.classed(metadata.name,true)
			.attr("id",metadata.mrgid)
			.attr("area","path-" + metadata.name)
			.attr("center",function(d){
				return path.centroid(d);	//determine and store centroid for use in handle
			})
			.attr("fill",color)
			.attr("stroke","#000000")
			.on("mouseover",function(){
				activateMapPiece(this,true);
			})
			.on("click", function(){
				window.open(metadata.link);
				console.log("clicked");
			})
			.on("mouseout", function(){
				activateMapPiece(this,false);
			});
	}
}

// Builds and attaches circular handles to a provided group
attachHandles = function(g,pathGroup,path,options,data){
	g.selectAll("circle")
		.data(data)
		.enter()
		.append("circle")
		.attr("area",function(d){
			return "handle-" + d.name;
		})
		.attr("class",function(d){
			return "mapHandle handle-" + d.name;
		})
		.attr("r",8)
		.attr("cx", function(d){
			for(var j = 0; j < pathGroup.data().length; j++){
				var p = pathGroup.data()[j];
				if (p.properties.mrgid == d.mrgid){
					var t = path.centroid(p);
					d.x = t[0];
					d.y = t[1];
					if(options.rotate){ 
						d.x += d.adjustCenter.rotate[0] * options.width/100;
						d.y += d.adjustCenter.rotate[1] * options.height/100;
					}else{
						d.x += d.adjustCenter.standard[0] * options.width/100;
						d.y += d.adjustCenter.standard[1] * options.height/100;
					}
					return d.x;
				}
			}
		})
		.attr("cy", function(d){
			return d.y;
		})
		.on("mouseover",function(){
			activateMapPiece(this,true);
		})
		.on("click", function(){
			window.open(metadata.link);
		})
		.on("mouseout", function(){
			activateMapPiece(this,false);
		});	
}

// Converts the style of a map piece and associated handle
activateMapPiece = function(el,toggle){
	var area = d3.select(el).attr("area").split("-")[1];
	var opacity = toggle ? 0.75 : 1;
				
	d3.selectAll("." + area)
		.style("opacity",opacity);
	d3.select(".handle-" + area)
		.classed('active', toggle);
}