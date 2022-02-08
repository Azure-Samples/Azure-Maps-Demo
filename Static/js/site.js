var map, datasource, popup, searchInput, locateMeButton, resultsPanel, searchInputLength, centerMapOnResults, routeURL, searchURL;

// Default location: Tower of London
var userPosition = [-0.076083, 51.508120]
var userPositionUpdated = false;

var weatherAlongRouteUrl = 'https://{azMapsDomain}/weather/route/json?api-version=1.0&query={query}';

//The minimum number of characters needed in the search input before a search is performed.
var minSearchInputLength = 3;

//The number of ms between key strokes to wait before performing a search.
var keyStrokeDelay = 250;

function GetMap() {
    //Initialize a map instance.
    map = new atlas.Map('demoMap', {
        center: userPosition,
        zoom: 16,
        pitch: 60,
        showBuildingModels: true,
        view: 'Auto',

        //Add authentication details for connecting to Azure Maps.
        authOptions: {
            //Use Azure Active Directory authentication.
            authType: 'anonymous',
            clientId: 'e6b6ab59-eb5d-4d25-aa57-581135b927f0', //Your Azure Maps client id for accessing your Azure Maps account.
            getToken: function (resolve, reject, map) {
                //URL to your authentication service that retrieves an Azure Active Directory Token.
                var tokenServiceUrl = "https://samples.azuremaps.com/api/GetAzureMapsToken";

                fetch(tokenServiceUrl).then(r => r.text()).then(token => resolve(token));
            }

            //Alternatively, use an Azure Maps key. Get an Azure Maps key at https://azure.com/maps. NOTE: The primary key should be used as the key.
            //authType: 'subscriptionKey',
            //subscriptionKey: '[YOUR_AZURE_MAPS_KEY]'
        }
    });

    //Store a reference to the Search Info Panel.
    resultsPanel = document.getElementById("results-panel");

    //Add key up event to the search box.
    searchInput = document.getElementById("search-input");
    searchInput.addEventListener("keyup", searchInputKeyup);

    //Add click event to the locate me button.
    locateMeButton = document.getElementById("locate-me-button");
    locateMeButton.addEventListener("click", locateMe);

    //Create a popup which we can reuse for each result.
    popup = new atlas.Popup();

    //Use MapControlCredential to share authentication between a map control and the service module.
    var pipeline = atlas.service.MapsURL.newPipeline(new atlas.service.MapControlCredential(map));

    //Construct the RouteURL object
    routeURL = new atlas.service.RouteURL(pipeline);

    //Construct the SearchURL object
    searchURL = new atlas.service.SearchURL(pipeline);

    //Wait until the map resources are ready.
    map.events.add('ready', function () {

        //Create a data source and add it to the map.
        datasource = new atlas.source.DataSource();
        map.sources.add(datasource);

        //Add a layer for rendering the search results.
        var searchLayer = new atlas.layer.SymbolLayer(datasource, null, {
            iconOptions: {
                image: 'marker-darkblue',
                anchor: 'center',
                allowOverlap: true
            },
            filter: ['==', 'type', 'POI']
        });

        //Add a layer for rendering the route.
        var routeLayer = new atlas.layer.LineLayer(datasource, null, {
            strokeColor: 'rgb(108, 50, 255)',
            strokeWidth: 5,
            filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']]
        });

        var routeLayerPoint = new atlas.layer.SymbolLayer(datasource, null, {
            iconOptions: {
                image: 'pin-round-red',
                anchor: 'center',
                allowOverlap: true
            },
            filter: ['==', 'layer', 'routePoint']
        });

        //Create a polygon layer to render the filled in area of the accuracy circle for the users position.
        var loacteMeLayer = new atlas.layer.PolygonLayer(datasource, null, {
            fillColor: 'rgba(0, 153, 255, 0.5)',
            filter: ['==', 'layer', 'locateMe']
        });

        //Create a symbol layer to render the users position on the map.
        var loacteMeSymbolLayer = new atlas.layer.SymbolLayer(datasource, null, {
            iconOptions: {
                image: 'marker-red',
                anchor: 'center',
                allowOverlap: true
            },
            filter: ['==', 'layer', 'locateMe']
        });

        map.layers.add([routeLayerPoint, routeLayer, loacteMeLayer, loacteMeSymbolLayer, searchLayer]);

        //Add a click event to the search layer and show a popup when a result is clicked.
        map.events.add("click", searchLayer, function (e) {
            //Make sure the event occurred on a shape feature.
            if (e.shapes && e.shapes.length > 0) {
                showPopupPOI(e.shapes[0]);
            }
        });

        map.events.add("click", routeLayerPoint, function (e) {
            //Make sure the event occurred on a shape feature.
            if (e.shapes && e.shapes.length > 0) {
                showPopupRoutePoint(e.shapes[0]);
            }
        });

        //Create an instance of the drawing manager and display the drawing toolbar.
        var drawingManager = new atlas.drawing.DrawingManager(map, {
            interactionType: 'click',
            toolbar: new atlas.control.DrawingToolbar({
                position: 'top-right'
            })
        });

        //When the drawing started, check to see if the interaction type is set to click, and if it is, re-enable panning of the map.
        map.events.add('drawingstarted', drawingManager, () => {
            if (drawingManager.getOptions().interactionType === 'click') {
                map.setUserInteraction({ dragPanInteraction: true });
            }
        });

        //Map Controls
        map.controls.add(new atlas.control.StyleControl({
            mapStyles: ['road', 'road_shaded_relief', 'grayscale_light', 'night', 'grayscale_dark', 'satellite', 'satellite_road_labels', 'high_contrast_dark']
        }), {
            position: 'top-right'
        });

        map.controls.add(new atlas.control.TrafficControl(), {
            position: 'top-right'
        });

        map.controls.add(new atlas.control.TrafficLegendControl(), {
            position: 'bottom-left'
        });

        map.controls.add(new atlas.control.ZoomControl(), {
            position: 'top-right'
        });

        map.controls.add(new atlas.control.PitchControl(), {
            position: 'top-right'
        });

        map.controls.add(new atlas.control.CompassControl(), {
            position: 'top-right'
        });
    });
}

function clearSerach() {
    //Remove any previous results from the map.
    resultsPanel.innerHTML = '';
    datasource.clear();
    popup.close();
}

function locateMe(e) {

    var locateMeIcon = document.getElementById("locate-me-icon");
    var locateMeSpinner = document.getElementById("locate-me-spinner");

    clearSerach();
    searchInput.value = '';

    locateMeButton.disabled = true;
    locateMeIcon.style.display = 'none';
    locateMeSpinner.style.display = 'block';

    //User position
    navigator.geolocation.getCurrentPosition(function (position) {

        //Create a circle from a Point feature by providing it a subType property set to "Circle" and radius property.
        userPosition = [position.coords.longitude, position.coords.latitude];
        var userPoint = new atlas.data.Point(userPosition);

        //Add a point feature with Circle properties to the data source for the users position. This will be rendered as a polygon.
        datasource.add(new atlas.data.Feature(userPoint, {
            layer: "locateMe",
            subType: "Circle",
            radius: position.coords.accuracy
        }));

        //Center the map on the users position.
        map.setCamera({
            center: userPosition,
            zoom: 15,
            pitch: 0
        });

        userPositionUpdated = true;

        locateMeButton.disabled = false;
        locateMeIcon.style.display = 'block';
        locateMeSpinner.style.display = 'none';

    }, function (error) {
        //If an error occurs when trying to access the users position information, display an error message.
        switch (error.code) {
            case error.PERMISSION_DENIED:
                alert('User denied the request for Geolocation.');
                break;
            case error.POSITION_UNAVAILABLE:
                alert('Position information is unavailable.');
                break;
            case error.TIMEOUT:
                alert('The request to get user position timed out.');
                break;
            case error.UNKNOWN_ERROR:
                alert('The request to get user position has an unknown error.');
                break;
        }

        locateMeButton.disabled = false;
        locateMeIcon.style.display = 'block';
        locateMeSpinner.style.display = 'none';
    });
}

function searchInputKeyup(e) {
    centerMapOnResults = false;
    if (searchInput.value.length >= minSearchInputLength) {
        if (e.keyCode === 13) {
            centerMapOnResults = true;
        }
        setTimeout(function () {
            if (searchInputLength === searchInput.value.length) {
                search();
            }
        }, keyStrokeDelay);
    } else {
        resultsPanel.innerHTML = '';
    }
    searchInputLength = searchInput.value.length;
}

function search() {

    clearSerach();

    var query = searchInput.value;

    searchURL.searchPOI(atlas.service.Aborter.timeout(10000), query, {
        lon: map.getCamera().center[0],
        lat: map.getCamera().center[1],
        maxFuzzyLevel: 4,
        view: 'Auto'
    }).then((results) => {

        //Extract GeoJSON feature collection from the response and add it to the datasource
        var data = results.geojson.getFeatures();
        datasource.add(data);

        if (centerMapOnResults) {
            map.setCamera({
                bounds: data.bbox
            });
        }

        //Create the HTML for the results list.
        var html = "";
        for (var i = 0; i < data.features.length; i++) {
            var r = data.features[i];
            html += `<a href="#" class="list-group-item list-group-item-action d-flex gap-3 py-3" aria-current="true" onclick="itemClicked('${r.id}')" onmouseover="itemHovered('${r.id}')"><svg class="flex-shrink-0" width="2.0em" height="2.0em"><use xlink:href="#geo-icon"/></svg><div class="d-flex gap-2 w-100 justify-content-between"><div><h6 class="mb-0">${r.properties.poi.name}</h6><p class="mb-0 opacity-75">${r.properties.address.freeformAddress}</p></div><small class="opacity-50 text-nowrap">${r.properties.dist.toFixed()} m</small></div></a>`;
        }
        resultsPanel.innerHTML = html;

    });
}

function itemHovered(id) {
    //Show a popup when hovering an item in the result list.
    var shape = datasource.getShapeById(id);
    showPopupPOI(shape);
}

function itemClicked(id) {
    //Center the map over the clicked item from the result list.
    var shape = datasource.getShapeById(id);
    var coordinates = shape.getCoordinates();

    map.setCamera({
        center: coordinates,
        zoom: 16
    });
}

function addressClicked(id) {
    //Center the map over the clicked item from the result list.
    var shape = datasource.getShapeById(id);
    var endPoint = shape.getCoordinates();
    var startPoint = userPosition;

    //Calculate a route.
    routeURL.calculateRouteDirections(atlas.service.Aborter.timeout(10000), [startPoint, endPoint], {
        maxAlternatives: 0,
        instructionsType: 'text',
        traffic: true
    }).then((r) => {
        if (r && r.routes && r.routes.length > 0) {
            var route = r.routes[0];
            var routeCoordinates = [];
            for (var legIndex = 0; legIndex < route.legs.length; legIndex++) {
                var leg = route.legs[legIndex];

                //Convert the route point data into a format that the map control understands.
                var legCoordinates = leg.points.map(function (point) {
                    return [point.longitude, point.latitude];
                });

                //Combine the route point data for each route leg together to form a single path.
                routeCoordinates = routeCoordinates.concat(legCoordinates);
            }

            //Create a line from the route path points and add it to the data source.
            routeLine = new atlas.data.LineString(routeCoordinates);

            //Display the route line on the map.
            datasource.add(routeLine);

            //Have the map focus on the route. 
            map.setCamera({
                bounds: atlas.data.BoundingBox.fromData(routeLine),
                padding: 80
            });

            var waypoints = [];
            var alongRouteWaypoints = [];

            var heading = 0;

            //Loop through up to 60 instructions and create waypoints.
            //Capture the waypoint information needed for the weather along route API which is "latitude,longitude,ETA (in minutes),heading".
            var len = Math.min(route.guidance.instructions.length, 60);

            for (var i = 0; i < len; i++) {
                var ins = route.guidance.instructions[i];
                ins.layer = "routePoint";

                var timeInMinutes = Math.round(ins.travelTimeInSeconds / 60);

                //Don't get weather for instructions that are more than two hours away from the start of the route.
                if (timeInMinutes > 120) {

                    // BUG? shoud it be: continue;
                    break;
                }

                var pos = [ins.point.longitude, ins.point.latitude];

                waypoints.push(new atlas.data.Feature(new atlas.data.Point(pos), ins));

                //Calculate the heading.
                if (i < route.guidance.instructions.length - 1) {
                    var ins2 = route.guidance.instructions[i + 1];
                    heading = Math.round(atlas.math.getHeading(pos, [ins2.point.longitude, ins2.point.latitude]));
                }

                alongRouteWaypoints.push(`${ins.point.latitude},${ins.point.longitude},${timeInMinutes},${heading}`);
            }

            //Get weather data.
            var requestUrl = weatherAlongRouteUrl.replace('{query}', alongRouteWaypoints.join(':'));

            processRequest(requestUrl).then(response => {
                if (response && response.waypoints && response.waypoints.length === waypoints.length) {

                    //Combine the weather data in with each waypoint.
                    for (var i = 0, len = response.waypoints.length; i < len; i++) {
                        Object.assign(waypoints[i].properties, response.waypoints[i]);
                    }

                    //Render the waypoints on the map.
                    datasource.add(waypoints);
                }
            });
        }
    });

    popup.close(map);
}

function truckClicked(id) {
    //Center the map over the clicked item from the result list.
    var shape = datasource.getShapeById(id);
    var endPoint = shape.getCoordinates();
    var startPoint = userPosition;

    //Calculate a route.
    routeURL.calculateRouteDirections(atlas.service.Aborter.timeout(10000), [startPoint, endPoint], {
        traffic: true,
        travelMode: 'truck'
    }).then((r) => {
        //Get the route data as GeoJSON and add it to the data source.
        var data = directions.geojson.getFeatures();
        datasource.add(data);
    });

    popup.close(map);
}

function showPopupPOI(shape) {
    popup.close();

    var properties = shape.getProperties();

    if (!properties || !properties.poi) return;

    if (!properties.poi.phone) properties.poi.phone = '';
    if (!properties.poi.url) properties.poi.url = '';

    var html = `<div class="card" style="width:420px;"><div class="card-header"><h5 class="card-title">${properties.poi.name}</h5></div><div class="card-body"><div class="list-group"><a href="#" onclick="addressClicked('${shape.data.id}')" class="list-group-item list-group-item-action d-flex gap-3 py-3" aria-current="true"><svg width="32" height="32" class="flex-shrink-0"><use xlink:href="#cursor-icon"/></svg><div class="d-flex gap-2 w-100 justify-content-between"><div><h6 class="mb-0">Address</h6><p class="mb-0 opacity-75">${properties.address.freeformAddress}</p></div></div></a><a target="_blank" href="tel:${properties.poi.phone.replace(/\s/g, '')}" class="list-group-item list-group-item-action d-flex gap-3 py-3 ${properties.poi.phone === '' ? 'visually-hidden' : ''}" aria-current="true"><svg width="32" height="32" class="flex-shrink-0"><use xlink:href="#phone-icon"/></svg><div class="d-flex gap-2 w-100 justify-content-between"><div><h6 class="mb-0">Phone</h6><p class="mb-0 opacity-75">${properties.poi.phone}</p></div></div></a><a target="_blank" href="https://${properties.poi.url.replace(/^https?\:\/\//i, '')}" class="list-group-item list-group-item-action d-flex gap-3 py-3 ${properties.poi.url === '' ? 'visually-hidden' : ''}" aria-current="true"><svg width="32" height="32" class="flex-shrink-0"><use xlink:href="#link-icon"/></svg><div class="d-flex gap-2 w-100 justify-content-between"><div><h6 class="mb-0">Website</h6><p class="mb-0 opacity-75">${properties.poi.url.replace(/^https?\:\/\//i, '')}</p></div></div></a></div></div><div class="card-footer text-muted">${properties.dist.toFixed()} meters away from ${userPositionUpdated === true ? 'you' : 'the Tower of London'}</div></div>`;

    popup.setOptions({
        position: shape.getCoordinates(),
        content: html
    });

    popup.open(map);
}

function showPopupRoutePoint(shape) {
    popup.close();

    var properties = shape.getProperties();

    if (!properties) return;

    if (!properties.street) properties.street = 'Directions & Weather';

    var html = `<div class="card" style="width:380px;"><div class="card-header"><h5 class="card-title">${properties.street}</h5></div><div class="card-body"><img class="weather-icon" src="/images/icons/weather-black/${properties.iconCode}.png"/><div class="weather-content"><div class="weather-temp">${properties.temperature.value}&#176;${properties.temperature.unit}</div>Wind: ${properties.wind.speed.value} ${properties.wind.speed.unit}<div class="weather-phrase">${properties.shortPhrase}</div>Clouds: ${properties.cloudCover}&#37</div></div><div class="card-footer text-muted">${properties.message}</div></div>`;

    popup.setOptions({
        position: shape.getCoordinates(),
        content: html
    });

    popup.open(map);
}

function processRequest(url) {
    //This is a reusable function that sets the Azure Maps platform domain, sings the request, and makes use of any transformRequest set on the map.
    return new Promise((resolve, reject) => {
        //Replace the domain placeholder to ensure the same Azure Maps cloud is used throughout the app.
        url = url.replace('{azMapsDomain}', atlas.getDomain());

        //Get the authentication details from the map for use in the request.
        var requestParams = map.authentication.signRequest({ url: url });

        //Transform the request.
        var transform = map.getServiceOptions().tranformRequest;
        if (transform) {
            requestParams = transform(url);
        }

        fetch(requestParams.url, {
            method: 'GET',
            mode: 'cors',
            headers: new Headers(requestParams.headers)
        })
            .then(r => r.json(), e => reject(e))
            .then(r => {
                resolve(r);
            }, e => reject(e));
    });
}