/* Azure Maps Demo
 * """""""""""""""
 * 
 * MIT License - Copyright (c) Microsoft Corporation. All rights reserved.
 * 
 */

// Global
var map, datasource, popup;
var radarLayer, infraredLayer, contourNumbersLayer, contourLayer;
var searchInput, locateMeButton, resultsPanel, searchInputLength, radarButton, infraredButton, contoursButton, clearButton;

// Default location: Tower of London
var userPosition = [-0.076083, 51.508120];
var userPositionUpdated = false;
var layerStyle = 'road';
var centerMapOnResults = false;

// Azure Maps API REST Services
var weatherUrl = 'https://{azMapsDomain}/weather/currentConditions/json?api-version=1.1&query={query}';
var tileUrl = 'https://{azMapsDomain}/map/tile?api-version=2.1&tilesetId={tilesetId}&zoom={z}&x={x}&y={y}&tileSize={tileSize}&view=Auto';
var airQualityUrl = 'https://{azMapsDomain}/weather/airQuality/current/json?api-version=1.1&query={query}';
var routeURL;
var searchURL;

function GetMap() {
    // Initialize a map instance.
    map = new atlas.Map('demoMap', {
        center: userPosition,
        zoom: 16,
        view: 'Auto',
        style: layerStyle,

        // Add authentication details for connecting to Azure Maps.
        authOptions: {
            // Use Azure Active Directory authentication.
            authType: 'anonymous',
            // Your Azure Maps client id for accessing your Azure Maps account.
            clientId: 'e6b6ab59-eb5d-4d25-aa57-581135b927f0',
            getToken: function (resolve, reject, map) {
                // URL to your authentication service that retrieves an Azure Active Directory Token.
                var tokenServiceUrl = "https://samples.azuremaps.com/api/GetAzureMapsToken";
                fetch(tokenServiceUrl).then(r => r.text()).then(token => resolve(token));
            }

            // Alternatively, use an Azure Maps key. Get an Azure Maps key at https://azure.com/maps.
            // NOTE: The primary key should be used as the key.
            //authType: 'subscriptionKey',
            //subscriptionKey: '[YOUR_AZURE_MAPS_KEY]'
        }
    });

    // Store a reference to the Search Info Panel.
    resultsPanel = document.getElementById("results-panel");

    // Add key up event to the search box.
    searchInput = document.getElementById("search-input");
    searchInput.addEventListener("keyup", searchInputKeyup);
    searchInput.addEventListener('search', function () {
        if (searchInput.value.trim().length < 3) {
            resultsPanel.innerHTML = '';
        }
    });

    var elm = document.getElementById('search-country');
    elm.addEventListener("change", search);

    // Use MapControlCredential to share authentication between a map control and the service module.
    var pipeline = atlas.service.MapsURL.newPipeline(new atlas.service.MapControlCredential(map));
    routeURL = new atlas.service.RouteURL(pipeline);
    searchURL = new atlas.service.SearchURL(pipeline);

    // Add click events
    locateMeButton = document.getElementById("locate-me-button");
    locateMeButton.addEventListener("click", locateMe);

    radarButton = document.getElementById("radar-button");
    radarButton.addEventListener("click", loadRadarLayer);

    infraredButton = document.getElementById("infrared-button");
    infraredButton.addEventListener("click", loadInfraredLayer);

    clearButton = document.getElementById("clearmap-button");
    clearButton.addEventListener("click", function () {
        clearSearch();
        searchInput.value = '';
    });

    // Create a popup which we can reuse for each result.
    popup = new atlas.Popup();

    // Wait until the map resources are ready.
    map.events.add('ready', function () {

        // Create a data source and add it to the map.
        datasource = new atlas.source.DataSource();
        map.sources.add(datasource);

        // Icons from https://icons.getbootstrap.com/
        map.imageSprite.add('geo-icon', 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgZmlsbD0iIzUxN0NFRCIgdmlld0JveD0iMCAwIDE2IDE2Ij48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik04IDFhMyAzIDAgMSAwIDAgNiAzIDMgMCAwIDAgMC02ek00IDRhNCA0IDAgMSAxIDQuNSAzLjk2OVYxMy41YS41LjUgMCAwIDEtMSAwVjcuOTdBNCA0IDAgMCAxIDQgMy45OTl6bTIuNDkzIDguNTc0YS41LjUgMCAwIDEtLjQxMS41NzVjLS43MTIuMTE4LTEuMjguMjk1LTEuNjU1LjQ5M2ExLjMxOSAxLjMxOSAwIDAgMC0uMzcuMjY1LjMwMS4zMDEgMCAwIDAtLjA1Ny4wOVYxNGwuMDAyLjAwOGEuMTQ3LjE0NyAwIDAgMCAuMDE2LjAzMy42MTcuNjE3IDAgMCAwIC4xNDUuMTVjLjE2NS4xMy40MzUuMjcuODEzLjM5NS43NTEuMjUgMS44Mi40MTQgMy4wMjQuNDE0czIuMjczLS4xNjMgMy4wMjQtLjQxNGMuMzc4LS4xMjYuNjQ4LS4yNjUuODEzLS4zOTVhLjYxOS42MTkgMCAwIDAgLjE0Ni0uMTUuMTQ4LjE0OCAwIDAgMCAuMDE1LS4wMzNMMTIgMTR2LS4wMDRhLjMwMS4zMDEgMCAwIDAtLjA1Ny0uMDkgMS4zMTggMS4zMTggMCAwIDAtLjM3LS4yNjRjLS4zNzYtLjE5OC0uOTQzLS4zNzUtMS42NTUtLjQ5M2EuNS41IDAgMSAxIC4xNjQtLjk4NmMuNzcuMTI3IDEuNDUyLjMyOCAxLjk1Ny41OTRDMTIuNSAxMyAxMyAxMy40IDEzIDE0YzAgLjQyNi0uMjYuNzUyLS41NDQuOTc3LS4yOS4yMjgtLjY4LjQxMy0xLjExNi41NTgtLjg3OC4yOTMtMi4wNTkuNDY1LTMuMzQuNDY1LTEuMjgxIDAtMi40NjItLjE3Mi0zLjM0LS40NjUtLjQzNi0uMTQ1LS44MjYtLjMzLTEuMTE2LS41NThDMy4yNiAxNC43NTIgMyAxNC40MjYgMyAxNGMwLS41OTkuNS0xIC45NjEtMS4yNDMuNTA1LS4yNjYgMS4xODctLjQ2NyAxLjk1Ny0uNTk0YS41LjUgMCAwIDEgLjU3NS40MTF6IiAvPjwvc3ZnPg==');
        map.imageSprite.add('signpost-icon', 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgZmlsbD0iIzA0MjU3QyIgdmlld0JveD0iMCAwIDE2IDE2Ij48cGF0aCBkPSJNNyAxLjQxNFY0SDJhMSAxIDAgMCAwLTEgMXY0YTEgMSAwIDAgMCAxIDFoNXY2aDJ2LTZoMy41MzJhMSAxIDAgMCAwIC43NjgtLjM2bDEuOTMzLTIuMzJhLjUuNSAwIDAgMCAwLS42NEwxMy4zIDQuMzZhMSAxIDAgMCAwLS43NjgtLjM2SDlWMS40MTRhMSAxIDAgMCAwLTIgMHpNMTIuNTMyIDVsMS42NjYgMi0xLjY2NiAySDJWNWgxMC41MzJ6IiAvPjwvc3ZnPg==');
        map.imageSprite.add('signpost2-icon', 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgZmlsbD0iIzg2MkE2RiIgdmlld0JveD0iMCAwIDE2IDE2Ij48cGF0aCBkPSJNNyA3VjEuNDE0YTEgMSAwIDAgMSAyIDBWMmg1YTEgMSAwIDAgMSAuOC40bC45NzUgMS4zYS41LjUgMCAwIDEgMCAuNkwxNC44IDUuNmExIDEgMCAwIDEtLjguNEg5djEwSDd2LTVIMmExIDEgMCAwIDEtLjgtLjRMLjIyNSA5LjNhLjUuNSAwIDAgMSAwLS42TDEuMiA3LjRBMSAxIDAgMCAxIDIgN2g1em0xIDNWOEgybC0uNzUgMUwyIDEwaDZ6bTAtNWg2bC43NS0xTDE0IDNIOHYyeiIgLz48L3N2Zz4=');
        map.imageSprite.add('map-icon', 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgZmlsbD0iIzQyNEY4NSIgdmlld0JveD0iMCAwIDE2IDE2Ij48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNS44MTcuMTEzQS41LjUgMCAwIDEgMTYgLjV2MTRhLjUuNSAwIDAgMS0uNDAyLjQ5bC01IDFhLjUwMi41MDIgMCAwIDEtLjE5NiAwTDUuNSAxNS4wMWwtNC45MDIuOThBLjUuNSAwIDAgMSAwIDE1LjV2LTE0YS41LjUgMCAwIDEgLjQwMi0uNDlsNS0xYS41LjUgMCAwIDEgLjE5NiAwTDEwLjUuOTlsNC45MDItLjk4YS41LjUgMCAwIDEgLjQxNS4xMDN6TTEwIDEuOTFsLTQtLjh2MTIuOThsNCAuOFYxLjkxem0xIDEyLjk4IDQtLjhWMS4xMWwtNCAuOHYxMi45OHptLTYtLjhWMS4xMWwtNCAuOHYxMi45OGw0LS44eiIgLz48L3N2Zz4=');
        map.imageSprite.add('compass-icon', 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgZmlsbD0iI0M4NUVBRSIgdmlld0JveD0iMCAwIDE2IDE2Ij48cGF0aCBkPSJNOCAxNi4wMTZhNy41IDcuNSAwIDAgMCAxLjk2Mi0xNC43NEExIDEgMCAwIDAgOSAwSDdhMSAxIDAgMCAwLS45NjIgMS4yNzZBNy41IDcuNSAwIDAgMCA4IDE2LjAxNnptNi41LTcuNWE2LjUgNi41IDAgMSAxLTEzIDAgNi41IDYuNSAwIDAgMSAxMyAweiIgLz48cGF0aCBkPSJtNi45NCA3LjQ0IDQuOTUtMi44My0yLjgzIDQuOTUtNC45NDkgMi44MyAyLjgyOC00Ljk1eiIgLz48L3N2Zz4=');

        // Add layers for rendering the search results.
        var searchLayer = new atlas.layer.SymbolLayer(datasource, null, {
            iconOptions: {
                image: ['get', 'icon'],
                anchor: 'center',
                allowOverlap: true
            },
            filter: ['==', 'layer', 'searchLayer']
        });

        // Add layers for rendering the car and truck routes.
        var routeLayer = new atlas.layer.LineLayer(datasource, null, {
            strokeColor: ['get', 'strokeColor'],
            strokeWidth: ['get', 'strokeWidth'],
            strokeOpacity: 1.0,
            lineJoin: 'round',
            lineCap: 'round',
            filter: ['==', 'layer', 'routeLayer']
        });

        // Isochrone layers
        var isochroneLayer = new atlas.layer.PolygonLayer(datasource, null, {
            fillColor: 'rgba(0, 200, 0, 0.4)',
            filter: ['==', 'layer', 'isochroneLayer']
        });
        var isochroneLineLayer = new atlas.layer.LineLayer(datasource, null, {
            strokeColor: 'green',
            filter: ['==', 'layer', 'isochroneLayer']
        });

        // Create a polygon layer to render the filled in area of the accuracy circle for the users position.
        var loacteMeLayer = new atlas.layer.PolygonLayer(datasource, null, {
            fillColor: 'rgba(0, 153, 255, 0.5)',
            filter: ['==', 'layer', 'locateMe']
        });
        // Create a symbol layer to render the users position on the map.
        var loacteMeSymbolLayer = new atlas.layer.SymbolLayer(datasource, null, {
            iconOptions: {
                image: 'marker-red',
                anchor: 'center',
                allowOverlap: true
            },
            filter: ['==', 'layer', 'locateMe']
        });

        // Add layers to the map
        map.layers.add([loacteMeSymbolLayer, loacteMeLayer, searchLayer, isochroneLayer, isochroneLineLayer]);
        map.layers.add(routeLayer, 'labels');

        // Add a click event to the search layer and show a popup when a result is clicked.
        map.events.add("click", searchLayer, function (e) {
            if (e.shapes && e.shapes.length > 0) {
                showPopupPOI(e.shapes[0]);
            }
        });

        map.events.add("click", function (e) {
            if (e.shapes && e.shapes.length > 0 && e.shapes[0].source) {
                showPopup(e.position);
            }
        });

        // Create an instance of the drawing manager and display the drawing toolbar.
        var drawingManager = new atlas.drawing.DrawingManager(map, {
            interactionType: 'click',
            toolbar: new atlas.control.DrawingToolbar({
                position: 'bottom-right'
            })
        });

        // When the drawing started, check to see if the interaction type is set to click, and if it is, re-enable panning of the map.
        map.events.add('drawingstarted', drawingManager, () => {
            if (drawingManager.getOptions().interactionType === 'click') {
                map.setUserInteraction({ dragPanInteraction: true });
            }
        });

        // Map Controls
        map.controls.add([
            new atlas.control.StyleControl({
                autoSelectionMode: true,
                mapStyles: ['road', 'road_shaded_relief', 'grayscale_light', 'night', 'grayscale_dark', 'satellite', 'satellite_road_labels', 'high_contrast_dark']
            }),
            new atlas.control.TrafficControl(),
            new atlas.control.ZoomControl(),
            new atlas.control.PitchControl(),
            new atlas.control.CompassControl(),

        ], {
            position: 'top-right'
        });

        map.controls.add(new atlas.control.TrafficLegendControl(), {
            position: 'bottom-left'
        });

        // Redraw the map to fix a scaling issue.
        map.resize();
    });
}

function clearSearch() {
    resultsPanel.innerHTML = '';
    datasource.clear();
    popup.close();
}

function locateMe(e) {

    var locateMeIcon = document.getElementById("locate-me-icon");
    var locateMeSpinner = document.getElementById("locate-me-spinner");

    locateMeButton.disabled = true;
    locateMeButton.className = 'btn btn-warning';
    locateMeIcon.style.display = 'none';
    locateMeSpinner.style.display = 'block';

    //User position
    navigator.geolocation.getCurrentPosition(function (position) {

        userPositionUpdated = true;
        userPosition = [position.coords.longitude, position.coords.latitude];

        //Center the map on the users position.
        map.setCamera({
            center: userPosition,
            zoom: 15,
            pitch: 0,
            bearing: 0
        });

        searchURL.searchAddressReverse(atlas.service.Aborter.timeout(10000), userPosition, {
            view: 'Auto'
        }).then((result) => {

            if (result.addresses.length > 0) {
                document.querySelector('.form-select').value = result.addresses[0].address.countryCode;
                search();
            }

            //Create a circle from a Point feature by providing it a subType property set to "Circle" and radius property.
            var userPoint = new atlas.data.Point(userPosition);
            //Add a point feature with Circle properties to the data source for the users position. This will be rendered as a polygon.
            datasource.add(new atlas.data.Feature(userPoint, {
                layer: "locateMe",
                subType: "Circle",
                radius: position.coords.accuracy
            }));

            locateMeButton.disabled = false;
            locateMeButton.className = 'btn btn-outline-secondary';
            locateMeIcon.style.display = 'block';
            locateMeSpinner.style.display = 'none';
        });

    }, function (error) {
        //If an error occurs when trying to access the users position information, display an error message.
        alert('Sorry, your position information is unavailable!');

        locateMeButton.disabled = false;
        locateMeButton.className = 'btn btn-outline-secondary';
        locateMeIcon.style.display = 'block';
        locateMeSpinner.style.display = 'none';
    });
}

function searchInputKeyup(e) {
    const minSearchInputLength = 3;
    const keyStrokeDelay = 250;

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

    clearSearch();

    var query = searchInput.value.trim();
    var elm = document.getElementById('search-country');
    var countryIso = elm.options[elm.selectedIndex].value;

    if (!query) return;

    searchURL.searchFuzzy(atlas.service.Aborter.timeout(10000), query, {
        lon: map.getCamera().center[0],
        lat: map.getCamera().center[1],
        countrySet: [countryIso],
        typeahead: true,
        view: 'Auto'
    }).then((results) => {

        data = results.geojson.getFeatures();

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

            r.properties.icon = icon;
            r.properties.layer = 'searchLayer';

            html += `<a href="#" class="list-group-item list-group-item-action d-flex gap-3 py-3" onclick="itemClicked('${r.id}')" onmouseover="itemHovered('${r.id}')"><svg class="flex-shrink-0" width="2.0em" height="2.0em"><use xlink:href="#${icon}" /></svg><div class="d-flex gap-2 w-100 justify-content-between"><div><h6 class="mb-0">${name}</h6><p class="mb-0 opacity-75">${r.properties.address.freeformAddress}</p></div><small class="text-nowrap">${dist} km</small></div></a>`;
        }
        resultsPanel.innerHTML = html;

        datasource.add(data);

        if (centerMapOnResults) {
            map.setCamera({
                bounds: data.bbox
            });
        }
    });
}

function itemClicked(id) {
    
    var shape = datasource.getShapeById(id);
    var coordinates = shape.getCoordinates();

    //Center the map over the clicked item from the result list.
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
        traffic: true,
        travelMode: 'car'
    }).then((directions) => {
        //Get data features from response
        var data = directions.geojson.getFeatures();

        //Get the route line and add some style properties to it.  
        var routeLine = data.features[0];
        routeLine.properties.strokeColor = '#B76DAB';
        routeLine.properties.strokeWidth = 5;
        routeLine.properties.layer = 'routeLayer';

        datasource.add(routeLine);
    }, reason => {
        alert('Sorry, it was not possible to route to this location.');
    });

    popup.close(map);
}

function truckClicked(id) {
    // Center the map over the clicked item from the result list.
    var shape = datasource.getShapeById(id);
    var endPoint = shape.getCoordinates();
    var startPoint = userPosition;

    // Calculate a route.
    routeURL.calculateRouteDirections(atlas.service.Aborter.timeout(10000), [startPoint, endPoint], {
        traffic: true,
        travelMode: 'truck'
    }).then((directions) => {
        // Get data features from response
        var data = directions.geojson.getFeatures();

        // Get the route line and add some style properties to it.  
        var routeLine = data.features[0];
        routeLine.properties.strokeColor = '#2272B9';
        routeLine.properties.strokeWidth = 9;
        routeLine.properties.layer = 'routeLayer';

        // Add the route line to the data source.
        // We want this to render below the car route which will likely be added to the data source faster,
        // so insert it at index 0.
        datasource.add(routeLine, 0);
    }, reason => {
        alert('Sorry, it was not possible to route to this location.');
    });

    popup.close(map);
}

function startpositionClicked(position) {

    userPosition = position;
    var userPoint = new atlas.data.Point(userPosition);

    datasource.add(new atlas.data.Feature(userPoint, {
        layer: "locateMe",
    }));

    // Center the map on the users position.
    map.setCamera({
        center: userPosition,
    });

    userPositionUpdated = true;

    popup.close();
}

function isochroneClicked(position) {

    var userPoint = new atlas.data.Point(position);

    datasource.add(new atlas.data.Feature(userPoint, {
        layer: "locateMe",
    }));

    map.setCamera({
        center: position,
        zoom: 11,
        pitch: 0,
        bearing: 0
    });

    Promise.all([
        routeURL.calculateRouteRange(atlas.service.Aborter.timeout(10000), position, {
            traffic: true,
            timeBudgetInSec: 15 * 60
        }),
        routeURL.calculateRouteRange(atlas.service.Aborter.timeout(10000), position, {
            traffic: true,
            timeBudgetInSec: 30 * 60
        })
    ]).then(values => {
        for (var i = 0; i < values.length; i++) {
            var f = values[i].geojson.getFeatures().features[0];
            f.properties.layer = 'isochroneLayer';

            datasource.add(f);
        }
    }, reason => {
        alert('Sorry, it was not possible to calculate travel time for this location.');
    });

    popup.close();
}

function showPopup(position) {
    popup.close();

    searchURL.searchAddressReverse(atlas.service.Aborter.timeout(10000), position, {
        view: 'Auto'
    }).then((result) => {

        if (result.addresses.length > 0) {
            var p = result.addresses[0];

            var name = p.address.street ? p.address.street : p.address.freeformAddress;
            var html = `<div class="card" style="width:420px;"><div class="card-header"><h5 class="card-title text-wrap">${name}</h5></div><div class="card-body"><div class="list-group"><a href="#" onclick="startpositionClicked([${position[0]},${position[1]}])" class="list-group-item list-group-item-action d-flex gap-3 py-3" aria-current="true"><svg width="32" height="32" class="flex-shrink-0"><use xlink:href="#bullseye-icon" /></svg><div class="d-flex gap-2 w-100 justify-content-between"><div><h6 class="mb-0">Use as starting point</h6><p class="mb-0 opacity-75 text-wrap">${p.address.freeformAddress}</p></div><small class="text-nowrap">Geocoding</small></div></a><a href="#" onclick="isochroneClicked([${position[0]},${position[1]}])" class="list-group-item list-group-item-action d-flex gap-3 py-3" aria-current="true"><svg width="32" height="32" class="flex-shrink-0"><use xlink:href="#clock-icon" /></svg><div class="d-flex gap-2 w-100 justify-content-between"><div><h6 class="mb-0">Travel time around this point</h6><p class="mb-0 opacity-75 text-wrap">How far can you drive in 15 and 30 minutes from this location including traffic conditions?</p></div><small class="text-nowrap">Isochrone</small></div></a></div></div></div></div>`;

            popup.setOptions({
                position: position,
                content: html
            });

            popup.open(map);
        }
    }, reason => {
        alert('Sorry, we where unable to find address details for this location.');
    });
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

    // Get Weather data
    var weatherRequestUrl = weatherUrl.replace('{query}', position[1] + ',' + position[0]);
    var weather = await processRequest(weatherRequestUrl).then(response => {
        if (response && response.results && response.results[0]) {
            return response.results[0];
        }
        return null;
    });

    // Get Air Quality data
    var airQualityRequestUrl = airQualityUrl.replace('{query}', position[1] + ',' + position[0]);
    var airQuality = await processRequest(airQualityRequestUrl).then(response => {
        if (response && response.results && response.results[0]) {
            return response.results[0];
        }
        return null;
    });

    var html = `<div class="card" style="width:420px;"><div class="card-header"><h5 class="card-title text-wrap">${name}</h5></div><div class="card-body"><div class="list-group"><a href="#" onclick="addressClicked('${shape.data.id}')" class="list-group-item list-group-item-action d-flex gap-3 py-3" ><svg width="32" height="32" class="flex-shrink-0"><use xlink:href="#cursor-icon" /></svg><div class="d-flex gap-2 w-100 justify-content-between"><div><h6 class="mb-0">Address</h6><p class="mb-0 opacity-75 text-wrap">${properties.address.freeformAddress}</p></div></div><small class="text-nowrap">Directions</small></a><a href="#" onclick="truckClicked('${shape.data.id}')" class="list-group-item list-group-item-action d-flex gap-3 py-3" ><svg width="32" height="32" class="flex-shrink-0"><use xlink:href="#truck-icon" /></svg><div class="d-flex gap-2 w-100 justify-content-between"><div><h6 class="mb-0">Truck Route</h6><p class="mb-0 opacity-75 text-wrap">Route that is optimized for commercial vehicles, like for trucks.</p></div></div><small class="text-nowrap">Directions</small></a><a target="_blank" href="tel:${phone.replace(/\s/g, '')}" class="list-group-item list-group-item-action d-flex gap-3 py-3 ${phone === '' ? 'd-none' : ''}" ><svg width="32" height="32" class="flex-shrink-0"><use xlink:href="#phone-icon" /></svg><div class="d-flex gap-2 w-100 justify-content-between"><div><h6 class="mb-0">Phone</h6><p class="mb-0 opacity-75">${phone}</p></div><small class="text-nowrap">POI</small></div></a><a target="_blank" href="http://${url.replace(/^https?\:\/\//i, '')}" class="list-group-item list-group-item-action d-flex gap-3 py-3 ${url === '' ? 'd-none' : ''}" ><svg width="32" height="32" class="flex-shrink-0"><use xlink:href="#link-icon" /></svg><div class="d-flex gap-2 w-100 justify-content-between"><div><h6 class="mb-0">Website</h6><p class="mb-0 opacity-75">${url.replace(/^https?\:\/\//i, '')}</p></div><small class="text-nowrap">POI</small></div></a><a target="_blank" href="https://docs.microsoft.com/rest/api/maps/weather/get-current-conditions" class="list-group-item list-group-item-action d-flex gap-3 py-3 ${!weather ? 'd-none' : ''}" ><img width="32" height="32" alt="Weather" aria-label="Weather" class="flex-shrink-0" src="/images/icons/weather-black/${weather.iconCode}.png"/><div class="d-flex gap-2 w-100 justify-content-between"><div><h6 class="mb-0">${weather.phrase}</h6><p class="mb-0 opacity-75 text-wrap">Temperature ${weather.temperature.value}&#176;${weather.temperature.unit} and feels like ${weather.realFeelTemperature.value}&#176;${weather.realFeelTemperature.unit}</p></div><small class="text-nowrap">Weather</small></div></a><a target="_blank" href="https://docs.microsoft.com//rest/api/maps/weather/get-current-air-quality" class="list-group-item list-group-item-action d-flex gap-3 py-3 ${!airQuality ? 'd-none' : ''}" ><svg width="32" height="32" class="flex-shrink-0"><use xlink:href="#balloon-icon" /></svg><div class="d-flex gap-2 w-100 justify-content-between"><div><h6 class="mb-0">${airQuality.category}</h6><p class="mb-0 opacity-75 text-wrap">${airQuality.description}</p></div><small class="text-nowrap">Air Quality</small></div></a></div></div><div class="card-footer text-muted">${dist} km away from ${userPositionUpdated === true ? 'you' : 'the Tower of London'}</div></div>`;

    popup.setOptions({
        position: position,
        content: html
    });

    popup.open(map);
}

function loadRadarLayer() {

    if (!radarLayer) {
        radarButton.className = 'btn btn-warning';

        layerStyle = map.getStyle().style;

        map.setStyle({
            style: 'grayscale_dark'
        });

        map.setCamera({
            zoom: 6,
            pitch: 0,
            bearing: 0
        });

        //Create a tile layer and add it to the map below the label layer.
        radarLayer = new atlas.layer.TileLayer({
            tileUrl: tileUrl.replace('{tilesetId}', 'microsoft.weather.radar.main').replace('{tileSize}', '256'),
            opacity: 0.8,
            tileSize: 256
        });

        map.layers.add(radarLayer, 'labels');
    } else {
        radarButton.className = 'btn btn-outline-secondary';

        map.layers.remove(radarLayer);
        radarLayer = null;

        map.setStyle({
            style: layerStyle
        });
    }
}

function loadInfraredLayer() {

    if (!infraredLayer) {
        infraredButton.className = 'btn btn-warning';

        layerStyle = map.getStyle().style;

        map.setStyle({
            style: 'grayscale_dark'
        });

        map.setCamera({
            zoom: 6,
            pitch: 0,
            bearing: 0
        });

        //Create a tile layer and add it to the map below the label layer.
        infraredLayer = new atlas.layer.TileLayer({
            tileUrl: tileUrl.replace('{tilesetId}', 'microsoft.weather.infrared.main').replace('{tileSize}', '256'),
            opacity: 0.8,
            tileSize: 256
        });

        map.layers.add(infraredLayer, 'labels');
    } else {
        infraredButton.className = 'btn btn-outline-secondary';

        map.layers.remove(infraredLayer);
        infraredLayer = null;

        map.setStyle({
            style: layerStyle
        });
    }
}

// This is a reusable function that sets the Azure Maps platform domain,
// sings the request, and makes use of any transformRequest set on the map.
function processRequest(url) {

    return new Promise((resolve, reject) => {
        // Replace the domain placeholder to ensure the same Azure Maps cloud is used throughout the app.
        url = url.replace('{azMapsDomain}', atlas.getDomain());

        // Get the authentication details from the map for use in the request.
        var requestParams = map.authentication.signRequest({ url: url });

        // Transform the request.
        var transform = map.getServiceOptions().tranformRequest;
        if (transform) {
            requestParams = transform(url);
        }

        // Get the reseult from the API
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