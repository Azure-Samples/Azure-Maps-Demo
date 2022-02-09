var map, datasource, popup, searchInput, locateMeButton, resultsPanel, searchInputLength, centerMapOnResults, routeURL, searchURL;

// Default location: Tower of London
var userPosition = [-0.076083, 51.508120]
var userPositionUpdated = false;

// Azure Weather Services
var weatherUrl = 'https://{azMapsDomain}/weather/currentConditions/json?api-version=1.1&query={query}';
var airQualityUrl = 'https://{azMapsDomain}/weather/airQuality/current/json?api-version=1.1&query={query}';

// The minimum number of characters needed in the search input before a search is performed.
var minSearchInputLength = 3;

// The number of ms between key strokes to wait before performing a search.
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

        // Icons from https://icons.getbootstrap.com/
        // Colors from https://www.colourlovers.com/
        // #517CED, #04257C, #862A6F, #424F85, #C85EAE
        var geoIcon = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="#517CED" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 4a4 4 0 1 1 4.5 3.969V13.5a.5.5 0 0 1-1 0V7.97A4 4 0 0 1 4 3.999zm2.493 8.574a.5.5 0 0 1-.411.575c-.712.118-1.28.295-1.655.493a1.319 1.319 0 0 0-.37.265.301.301 0 0 0-.057.09V14l.002.008a.147.147 0 0 0 .016.033.617.617 0 0 0 .145.15c.165.13.435.27.813.395.751.25 1.82.414 3.024.414s2.273-.163 3.024-.414c.378-.126.648-.265.813-.395a.619.619 0 0 0 .146-.15.148.148 0 0 0 .015-.033L12 14v-.004a.301.301 0 0 0-.057-.09 1.318 1.318 0 0 0-.37-.264c-.376-.198-.943-.375-1.655-.493a.5.5 0 1 1 .164-.986c.77.127 1.452.328 1.957.594C12.5 13 13 13.4 13 14c0 .426-.26.752-.544.977-.29.228-.68.413-1.116.558-.878.293-2.059.465-3.34.465-1.281 0-2.462-.172-3.34-.465-.436-.145-.826-.33-1.116-.558C3.26 14.752 3 14.426 3 14c0-.599.5-1 .961-1.243.505-.266 1.187-.467 1.957-.594a.5.5 0 0 1 .575.411z" /></svg>');
        map.imageSprite.add('geo-icon', geoIcon);

        var signpostIcon = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="#04257C" viewBox="0 0 16 16"><path d="M7 1.414V4H2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h5v6h2v-6h3.532a1 1 0 0 0 .768-.36l1.933-2.32a.5.5 0 0 0 0-.64L13.3 4.36a1 1 0 0 0-.768-.36H9V1.414a1 1 0 0 0-2 0zM12.532 5l1.666 2-1.666 2H2V5h10.532z" /></svg>');
        map.imageSprite.add('signpost-icon', signpostIcon);

        var signpost2Icon = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="#862A6F" viewBox="0 0 16 16"><path d="M7 7V1.414a1 1 0 0 1 2 0V2h5a1 1 0 0 1 .8.4l.975 1.3a.5.5 0 0 1 0 .6L14.8 5.6a1 1 0 0 1-.8.4H9v10H7v-5H2a1 1 0 0 1-.8-.4L.225 9.3a.5.5 0 0 1 0-.6L1.2 7.4A1 1 0 0 1 2 7h5zm1 3V8H2l-.75 1L2 10h6zm0-5h6l.75-1L14 3H8v2z" /></svg>');
        map.imageSprite.add('signpost2-icon', signpost2Icon);

        var mapIcon = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="#424F85" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M15.817.113A.5.5 0 0 1 16 .5v14a.5.5 0 0 1-.402.49l-5 1a.502.502 0 0 1-.196 0L5.5 15.01l-4.902.98A.5.5 0 0 1 0 15.5v-14a.5.5 0 0 1 .402-.49l5-1a.5.5 0 0 1 .196 0L10.5.99l4.902-.98a.5.5 0 0 1 .415.103zM10 1.91l-4-.8v12.98l4 .8V1.91zm1 12.98 4-.8V1.11l-4 .8v12.98zm-6-.8V1.11l-4 .8v12.98l4-.8z" /></svg>');
        map.imageSprite.add('map-icon', mapIcon);

        var compassIcon = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="#C85EAE" viewBox="0 0 16 16"><path d="M8 16.016a7.5 7.5 0 0 0 1.962-14.74A1 1 0 0 0 9 0H7a1 1 0 0 0-.962 1.276A7.5 7.5 0 0 0 8 16.016zm6.5-7.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z" /><path d="m6.94 7.44 4.95-2.83-2.83 4.95-4.949 2.83 2.828-4.95z" /></svg>');
        map.imageSprite.add('compass-icon', compassIcon);

        //Add layers for rendering the search results.
        var poiLayer = new atlas.layer.SymbolLayer(datasource, null, {
            iconOptions: {
                image: 'geo-icon',
                anchor: 'center',
                allowOverlap: true
            },
            filter: ['==', 'type', 'POI']
        });

        var streetLayer = new atlas.layer.SymbolLayer(datasource, null, {
            iconOptions: {
                image: 'signpost-icon',
                anchor: 'center',
                allowOverlap: true
            },
            filter: ['any', ['==', 'type', 'Street'], ['==', 'type', 'Point Address']]
        });

        var addressRangeLayer = new atlas.layer.SymbolLayer(datasource, null, {
            iconOptions: {
                image: 'map-icon',
                anchor: 'center',
                allowOverlap: true
            },
            filter: ['==', 'type', 'Address Range']
        });

        var geographyLayer = new atlas.layer.SymbolLayer(datasource, null, {
            iconOptions: {
                image: 'compass-icon',
                anchor: 'center',
                allowOverlap: true
            },
            filter: ['==', 'type', 'Geography']
        });

        var crossStreetLayer = new atlas.layer.SymbolLayer(datasource, null, {
            iconOptions: {
                image: 'signpost2-icon',
                anchor: 'center',
                allowOverlap: true
            },
            filter: ['==', 'type', 'Cross Street']
        });

        //Add layers for rendering the route.
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

        map.layers.add([loacteMeSymbolLayer, loacteMeLayer , poiLayer, streetLayer, addressRangeLayer, geographyLayer, crossStreetLayer, routeLayerPoint, routeLayer]);

        //Add a click event to the search layer and show a popup when a result is clicked.
        map.events.add("click", poiLayer, function (e) {
            if (e.shapes && e.shapes.length > 0) {
                showPopupPOI(e.shapes[0]);
            }
        });

        map.events.add("click", streetLayer, function (e) {
            if (e.shapes && e.shapes.length > 0) {
                showPopupPOI(e.shapes[0]);
            }
        });

        map.events.add("click", addressRangeLayer, function (e) {
            if (e.shapes && e.shapes.length > 0) {
                showPopupPOI(e.shapes[0]);
            }
        });

        map.events.add("click", geographyLayer, function (e) {
            if (e.shapes && e.shapes.length > 0) {
                showPopupPOI(e.shapes[0]);
            }
        });

        map.events.add("click", crossStreetLayer, function (e) {
            if (e.shapes && e.shapes.length > 0) {
                showPopupPOI(e.shapes[0]);
            }
        });

        map.events.add("click", routeLayerPoint, function (e) {
            if (e.shapes && e.shapes.length > 0) {
                showPopupRoutePoint(e.shapes[0]);
            }
        });

        //Create an instance of the drawing manager and display the drawing toolbar.
        var drawingManager = new atlas.drawing.DrawingManager(map, {
            interactionType: 'click',
            toolbar: new atlas.control.DrawingToolbar({
                position: 'bottom-right'
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
            pitch: 0,
            bearing: 0
        });

        userPositionUpdated = true;

        locateMeButton.disabled = false;
        locateMeIcon.style.display = 'block';
        locateMeSpinner.style.display = 'none';

    }, function (error) {
        //If an error occurs when trying to access the users position information, display an error message.
        alert('User position information is unavailable!');

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

    searchURL.searchFuzzy(atlas.service.Aborter.timeout(10000), query, {
        lon: map.getCamera().center[0],
        lat: map.getCamera().center[1],
        maxFuzzyLevel: 3,
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

            var icon = 'map-icon';
            var name = 'Location';
            var dist = r.properties.dist < 1 ? 0 : (r.properties.dist / 1000).toFixed(1);

            switch (r.properties.type) {
                case 'POI':
                    icon = 'geo-icon';
                    name = r.properties.poi.name;
                    break;
                case 'Street':
                case 'Point Address':
                    icon = 'signpost-icon';
                    name = r.properties.address.streetName;
                    break;
                case 'Geography':
                    icon = 'compass-icon';
                    name = r.properties.address.country;
                    break;
                case 'Address Range':
                    icon = 'map-icon';
                    name = 'Address Range';
                    break;
                case 'Cross Street':
                    icon = 'signpost2-icon';
                    name = r.properties.address.streetName;
                    break;
            }

            html += `<a href="#" class="list-group-item list-group-item-action d-flex gap-3 py-3" aria-current="true" onclick="itemClicked('${r.id}')" onmouseover="itemHovered('${r.id}')">
                    <svg class="flex-shrink-0" width="2.0em" height="2.0em"><use xlink:href="#${icon}" /></svg>
                    <div class="d-flex gap-2 w-100 justify-content-between">
                        <div>
                            <h6 class="mb-0">${name}</h6>
                            <p class="mb-0 opacity-75">${r.properties.address.freeformAddress}</p></div>
                            <small class="opacity-50 text-nowrap">${dist} km</small>
                        </div>
                </a>`;
        }
        resultsPanel.innerHTML = html;
    });
}

function itemClicked(id) {
    //Center the map over the clicked item from the result list.
    var shape = datasource.getShapeById(id);
    var coordinates = shape.getCoordinates();

    map.setCamera({
        center: coordinates,
        zoom: 16
    });

    showPopupPOI(shape);
}

function itemHovered(id) {
    //Show a popup when hovering an item in the result list.
    var shape = datasource.getShapeById(id);
    showPopupPOI(shape);
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
    }).then((directions) => {
        var data = directions.geojson.getFeatures();
        datasource.add(data);

        //if (r && r.routes && r.routes.length > 0) {
        //    var route = r.routes[0];
        //    var routeCoordinates = [];
        //    for (var legIndex = 0; legIndex < route.legs.length; legIndex++) {
        //        var leg = route.legs[legIndex];

        //        //Convert the route point data into a format that the map control understands.
        //        var legCoordinates = leg.points.map(function (point) {
        //            return [point.longitude, point.latitude];
        //        });

        //        //Combine the route point data for each route leg together to form a single path.
        //        routeCoordinates = routeCoordinates.concat(legCoordinates);
        //    }

        //    //Create a line from the route path points and add it to the data source.
        //    routeLine = new atlas.data.LineString(routeCoordinates);

        //    //Display the route line on the map.
        //    datasource.add(routeLine);

        //    //Have the map focus on the route. 
        //    map.setCamera({
        //        bounds: atlas.data.BoundingBox.fromData(routeLine),
        //        padding: 80
        //    });

        //    var waypoints = [];
        //    var alongRouteWaypoints = [];
        //    var heading = 0;

        //    //Loop through up to 60 instructions and create waypoints.
        //    //Capture the waypoint information needed for the weather along route API which is "latitude,longitude,ETA (in minutes),heading".
        //    var len = Math.min(route.guidance.instructions.length, 60);

        //    for (var i = 0; i < len; i++) {
        //        var ins = route.guidance.instructions[i];
        //        ins.layer = "routePoint";

        //        var pos = [ins.point.longitude, ins.point.latitude];

        //        waypoints.push(new atlas.data.Feature(new atlas.data.Point(pos), ins));

        //        //Calculate the heading.
        //        if (i < route.guidance.instructions.length - 1) {
        //            var ins2 = route.guidance.instructions[i + 1];
        //            heading = Math.round(atlas.math.getHeading(pos, [ins2.point.longitude, ins2.point.latitude]));
        //        }

        //        alongRouteWaypoints.push(`${ins.point.latitude},${ins.point.longitude},${timeInMinutes},${heading}`);
        //    }

        //    //Get weather data.
        //    var requestUrl = weatherAlongRouteUrl.replace('{query}', alongRouteWaypoints.join(':'));

        //    processRequest(requestUrl).then(response => {
        //        if (response && response.waypoints && response.waypoints.length === waypoints.length) {

        //            //Combine the weather data in with each waypoint.
        //            for (var i = 0, len = response.waypoints.length; i < len; i++) {
        //                Object.assign(waypoints[i].properties, response.waypoints[i]);
        //            }

        //            //Render the waypoints on the map.
        //            datasource.add(waypoints);
        //        }
        //    });
        //}
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
    }).then((directions) => {
        //Get the route data as GeoJSON and add it to the data source.
        var data = directions.geojson.getFeatures();
        datasource.add(data);
    });

    popup.close(map);
}

async function showPopupPOI(shape) {
    popup.close();

    var properties = shape.getProperties();
    var position = shape.getCoordinates();

    var name = 'Location';
    var dist = properties.dist < 1 ? 0 : (properties.dist / 1000).toFixed(1);
    var phone = '';
    var url = '';

    switch (properties.type) {
        case 'POI':
            name = properties.poi.name;
            if (properties.poi.phone) phone = properties.poi.phone;
            if (properties.poi.url) url = properties.poi.url;
            break;
        case 'Street':
        case 'Point Address':
        case 'Cross Street':
            name = properties.address.streetName;
            break;
        case 'Geography':
            name = properties.address.country;
            break;
        case 'Address Range':
            name = 'Address Range';
            break;
    }

    //Get weather data.
    var requestUrl = weatherUrl.replace('{query}', position[1] + ',' + position[0]);
    var weather = await processRequest(requestUrl).then(response => {
        if (response && response.results && response.results[0]) {
            return response.results[0];
        }
        return null;
    });

    var html = `<div class="card" style="width:420px;">
                <div class="card-header">
                    <h5 class="card-title">${name}</h5>
                </div>
                <div class="card-body">
                    <div class="list-group">
                        <a href="#" onclick="addressClicked('${shape.data.id}')" class="list-group-item list-group-item-action d-flex gap-3 py-3" aria-current="true">
                            <svg width="32" height="32" class="flex-shrink-0"><use xlink:href="#cursor-icon" /></svg>
                            <div class="d-flex gap-2 w-100 justify-content-between">
                                <div>
                                    <h6 class="mb-0">Address</h6>
                                    <p class="mb-0 opacity-75">${properties.address.freeformAddress}</p>
                                </div>
                            </div>
                        </a>
                        <a target="_blank" href="tel:${phone.replace(/\s/g, '')}" class="list-group-item list-group-item-action d-flex gap-3 py-3 ${phone === '' ? 'visually-hidden' : ''}" aria-current="true">
                            <svg width="32" height="32" class="flex-shrink-0"><use xlink:href="#phone-icon" /></svg>
                            <div class="d-flex gap-2 w-100 justify-content-between">
                                <div>
                                    <h6 class="mb-0">Phone</h6>
                                    <p class="mb-0 opacity-75">${phone}</p>
                                </div>
                            </div>
                        </a>
                        <a target="_blank" href="http://${url.replace(/^https?\:\/\//i, '')}" class="list-group-item list-group-item-action d-flex gap-3 py-3 ${url === '' ? 'visually-hidden' : ''}" aria-current="true">
                            <svg width="32" height="32" class="flex-shrink-0"><use xlink:href="#link-icon" /></svg>
                            <div class="d-flex gap-2 w-100 justify-content-between">
                                <div>
                                    <h6 class="mb-0">Website</h6>
                                    <p class="mb-0 opacity-75">${url.replace(/^https?\:\/\//i, '')}</p>
                                </div>
                            </div>
                        </a>
                        <a href="#" class="list-group-item list-group-item-action d-flex gap-3 py-3 ${!weather ? 'visually-hidden' : ''}" aria-current="true">
                            <img width="32" height="32" class="flex-shrink-0" src="/images/icons/weather-black/${weather.iconCode}.png"/>
                            <div class="d-flex gap-2 w-100 justify-content-between">
                                <div>
                                    <h6 class="mb-0">${weather.phrase}</h6>
                                    <p class="mb-0 opacity-75">Temperature: ${weather.temperature.value}&#176;${weather.temperature.unit}, Wind: ${weather.wind.speed.value} ${weather.wind.speed.unit}, Clouds: ${weather.cloudCover}&#37</p>
                                </div>
                            </div>
                        </a>
                    </div>
                </div>
                <div class="card-footer text-muted">
                    ${dist} km away from ${userPositionUpdated === true ? 'you' : 'the Tower of London'}
                </div>
            </div>`;

    popup.setOptions({
        position: position,
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