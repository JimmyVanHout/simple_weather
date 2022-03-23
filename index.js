function getUnitSystem() {
    return "imperial";
}

async function getGridAndLocation(coordinates) {
    let data = await fetch(`https://api.weather.gov/points/${coordinates["latitude"]},${coordinates["longitude"]}`).then(response => response.json());
    let grid = {
        id: data["properties"]["gridId"],
        x: data["properties"]["gridX"],
        y: data["properties"]["gridY"],
    }
    let locationData = data["properties"]["relativeLocation"]["properties"];
    let location = locationData["city"].concat(", ", locationData["state"]);
    return [grid, location];
}

function distance(x1, y1, x2, y2) {
    let d = Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2));
    return d;
}

async function getClosestStation(grid, currentCoordinates) {
    let stationsData = await fetch(`https://api.weather.gov/gridpoints/${grid.id}/${grid.x},${grid.y}/stations`).then(response => response.json());
    stationsData = stationsData["features"];
    let minDistance = null;
    let closestStation = null;
    for (let stationData of stationsData) {
        let stationCoordinates = {
            latitude: stationData["geometry"]["coordinates"][1],
            longitude: stationData["geometry"]["coordinates"][0],
        };
        let distanceCurrentToStation = distance(stationCoordinates.latitude, stationCoordinates.longitude, currentCoordinates.latitude, currentCoordinates.longitude);
        if (!minDistance || distanceCurrentToStation < minDistance) {
            minDistance = distanceCurrentToStation;
            closestStation = {
                id: stationData["properties"]["stationIdentifier"],
                name: stationData["properties"]["name"],
            };
        }
    }
    return closestStation;
}

async function getLatestObservation(station) {
    let observationData = await fetch(`https://api.weather.gov/stations/${station.id}/observations/latest`).then(response => response.json());
    observationData = observationData["properties"];
    let observation = {
        description: observationData["textDescription"] ?? "--",
        temperature: observationData["temperature"]["value"] && observationData["temperature"]["unitCode"] ? getTemperature(observationData["temperature"]["value"], observationData["temperature"]["unitCode"]) : "-- \u00B0F",
        windVelocity: observationData["windSpeed"]["value"] && observationData["windDirection"]["value"] && observationData["windSpeed"]["unitCode"] ? getWindVelocity(observationData["windSpeed"]["value"], observationData["windDirection"]["value"], observationData["windSpeed"]["unitCode"]) : "--",
        seaLevelPressure: observationData["seaLevelPressure"]["value"] && observationData["seaLevelPressure"]["unitCode"] ? getPressure(observationData["seaLevelPressure"]["value"], observationData["seaLevelPressure"]["unitCode"]) : "--",
        visibility: observationData["visibility"]["value"] && observationData["visibility"]["unitCode"] ? getVisibility(observationData["visibility"]["value"], observationData["visibility"]["unitCode"]) : "--",
        relativeHumidity: observationData["relativeHumidity"]["value"] ? getRelativeHumidity(observationData["relativeHumidity"]["value"]) : "--",
        windChill: observationData["windChill"]["value"] && observationData["windChill"]["unitCode"] ? getTemperature(observationData["windChill"]["value"], observationData["windChill"]["unitCode"]) : "--",
        heatIndex: observationData["heatIndex"]["value"] && observationData["heatIndex"]["unitCode"] ? getTemperature(observationData["heatIndex"]["value"], observationData["heatIndex"]["unitCode"]) : "--",
    }
    return observation;
}

async function getSemiDailyForecast(grid) {
    let semiDailyForecastData = await fetch(`https://api.weather.gov/gridpoints/${grid.id}/${grid.x},${grid.y}/forecast`).then(response => response.json());
    let periodsData = semiDailyForecastData["properties"]["periods"];
    let periods = [];
    for (let periodData of periodsData) {
        let windSpeedAndUnitsData = periodData["windSpeed"]?.split(" ");
        let period = {
            name: periodData["name"] ?? "",
            temperature: periodData["temperature"] && periodData["temperatureUnit"] ? getTemperature(periodData["temperature"], periodData["temperatureUnit"]) : "",
            windVelocity: windSpeedAndUnitsData.length > 1 ? getWindVelocity(windSpeedAndUnitsData[0], periodData["windDirection"], windSpeedAndUnitsData[1]) : "",
            description: periodData["shortForecast"] ?? "",
        }
        periods.push(period);
    }
    return periods;
}

function getDayOfWeek(data) {
    return (new Date(data)).toLocaleDateString(undefined, {weekday: "long"});
}

async function getHourlyForecast(grid) {
    let hourlyForecastData = await fetch(`https://api.weather.gov/gridpoints/${grid.id}/${grid.x},${grid.y}/forecast/hourly`).then(response => response.json());
    let periodsData = hourlyForecastData["properties"]["periods"];
    let periods = [];
    for (let periodData of periodsData) {
        let windSpeedAndUnitsData = periodData["windSpeed"]?.split(" ");
        let period = {
            startTime: periodData["startTime"] ? getTime(periodData["startTime"]) : "",
            endTime: periodData["endTime"] ? getTime(periodData["endTime"]) : "",
            dayOfWeek: periodData["startTime"] ? getDayOfWeek(periodData["startTime"]) : "",
            temperature: periodData["temperature"] ? getTemperature(periodData["temperature"], periodData["temperatureUnit"]) : "",
            windVelocity: windSpeedAndUnitsData.length > 1 ? getWindVelocity(windSpeedAndUnitsData[0], periodData["windDirection"], windSpeedAndUnitsData[1]) : "",
            description: periodData["shortForecast"] ?? "",
        }
        periods.push(period);
    }
    return periods;
}

function fillLatestObservationData(latestObservation) {
    let conditionsGrid = document.getElementById("conditions_grid");
    let currentTempAndDescrContainer = document.getElementById("current_temperature_and_description_container");
    let leafChildren = Array.from(conditionsGrid.children).concat(Array.from(currentTempAndDescrContainer.children));
    for (container of leafChildren) {
        let lst = container.id.split("_");
        if (lst.length == 2) {
            lst = lst.slice(1);
        } else if (lst.length > 2) {
            lst = lst.slice(1, -1);
        }
        let prop = camelCase(lst.join("_"));
        if (prop in latestObservation) {
            let text = document.getElementById("current_".concat(snakeCase(prop), "_text"));
            text.innerText = text.innerText.concat(` ${latestObservation[prop]}`);
        }
    }
}

function fillData(parent, data, textID="", containerClass=null, textClass=null, textElement="p") {
    let container = document.createElement("div");
    if (containerClass) {
        container.classList.add(containerClass);
    }
    parent.appendChild(container);
    let text = document.createElement(textElement);
    text.id = textID;
    if (textClass) {
        text.classList.add(textClass);
    }
    text.innerText = data;
    container.appendChild(text);
}

function addContainer(parent, containerID="", containerClass=null) {
    let container = document.createElement("div");
    container.id = containerID;
    if (containerClass) {
        container.classList.add(containerClass);
    }
    parent.appendChild(container);
    return container;
}

function shouldAddHFWindData() {
    return false;
}

function shouldAddSDFWindData() {
    return false;
}

function fillHourlyForecastData(hourlyForecast) {
    let hourlyForecastContainer = document.getElementById("hourly_forecast_data_container");
    let addWindData = shouldAddHFWindData();
    for (let i = 0; i < hourlyForecast.length; i++) {
        let periodContainer = document.createElement("div");
        periodContainer.id = "hourly_forecast_period_".concat(i.toString(), "_container");
        periodContainer.classList.add("hourly_forecast_period_container");
        fillData(periodContainer, hourlyForecast[i].dayOfWeek.concat(" ", hourlyForecast[i].startTime, " - ", hourlyForecast[i].endTime), "hourly_forecast_period_".concat(i.toString(), "_time"), "hourly_forecast_time_container", "hourly_forecast_time_text", "span");
        let weatherDataContainer = document.createElement("div");
        weatherDataContainer.id = "hourly_forecast_period_".concat(i.toString(), "_weather_data_container");
        weatherDataContainer.classList.add("hourly_forecast_weather_data_container");
        fillDataInContainer(weatherDataContainer, hourlyForecast[i].temperature, "hourly_forecast_period_".concat(i.toString(), "_temperature"), "hourly_forecast_temperature_text", "span");
        weatherDataContainer.appendChild(document.createElement("br"));
        fillDataInContainer(weatherDataContainer, hourlyForecast[i].description, "hourly_forecast_period_".concat(i.toString(), "_description"), "hourly_forecast_description_text", "span");
        if (addWindData) {
            weatherDataContainer.appendChild(document.createElement("br"));
            fillDataInContainer(weatherDataContainer, "Wind: ".concat(hourlyForecast[i].windVelocity), "hourly_forecast_period_".concat(i.toString(), "_wind_velocity"), "hourly_forecast_wind_velocity_text", "span");
        }
        periodContainer.appendChild(weatherDataContainer);
        hourlyForecastContainer.appendChild(periodContainer);
        if (i != hourlyForecast.length - 1) {
            hourlyForecastContainer.appendChild(document.createElement("hr"));
        }
    }
}

function drawHourlyForecastGraph(hourlyForecast) {
    let startTimes = hourlyForecast.map(period => period.dayOfWeek.concat(" ", period.startTime));
    let temperatures = hourlyForecast.map(period => period.temperature.split(" ")[0]);
    let canvas = document.getElementById("hourly_forecast_graph");
    let chart = new Chart(canvas, {
        type: "line",
        data: {
            labels: startTimes,
            datasets: [{
                label: "Temperature (\u00B0F)",
                data: temperatures,
                backgroundColor: "white",
                borderColor: "green",
            }]
        },
        options: {
            elements: {
                point: {
                    radius: 0,
                },
            },
        },
    });
}

function fillSemiDailyForecastData(semiDailyForecast) {
    let semiDailyForecastContainer = document.getElementById("semi_daily_forecast_data_container");
    let addWindData = shouldAddSDFWindData();
    for (let i = 0; i < semiDailyForecast.length; i++) {
        let periodContainer = document.createElement("div");
        periodContainer.id = "semi_daily_forecast_period_".concat(i.toString(), "_container");
        periodContainer.classList.add("semi_daily_forecast_period_container");
        fillData(periodContainer, semiDailyForecast[i].name, "semi_daily_forecast_period_".concat(i.toString(), "_name"), "semi_daily_forecast_name_container", "semi_daily_forecast_name_text", "span");
        let weatherDataContainer = document.createElement("div");
        weatherDataContainer.id = "semi_daily_forecast_period_".concat(i.toString(), "_weather_data_container");
        weatherDataContainer.classList.add("semi_daily_forecast_weather_data_container");
        fillDataInContainer(weatherDataContainer, semiDailyForecast[i].temperature, "semi_daily_forecast_period_".concat(i.toString(), "_temperature"), "semi_daily_forecast_temperature_text", "span");
        weatherDataContainer.appendChild(document.createElement("br"));
        fillDataInContainer(weatherDataContainer, semiDailyForecast[i].description, "semi_daily_forecast_period_".concat(i.toString(), "_description"), "semi_daily_forecast_description_text", "span");
        if (addWindData) {
            weatherDataContainer.appendChild(document.createElement("br"));
            fillDataInContainer(weatherDataContainer, "Wind: ".concat(semiDailyForecast[i].windVelocity), "semi_daily_forecast_period_".concat(i.toString(), "_wind_velocity"), "semi_daily_forecast_wind_velocity_text", "span");
        }
        periodContainer.appendChild(weatherDataContainer);
        semiDailyForecastContainer.appendChild(periodContainer);
        if (i != semiDailyForecast.length - 1) {
            semiDailyForecastContainer.appendChild(document.createElement("hr"));
        }
    }
}

function drawSemiDailyForecastGraph(semiDailyForecast) {
    let names = semiDailyForecast.filter(period => !period.name.includes("Night")).map(period => period.name);
    let temperatures = semiDailyForecast.map(period => period.temperature.split(" ")[0]);
    let dayTemperatures = [];
    let nightTemperatures = [];
    console.log(semiDailyForecast);
    console.log(names);
    for (let i = 0; i < temperatures.length; i++) {
        if (semiDailyForecast[i].name.includes("Tonight")) {
            dayTemperatures.push(null);
            nightTemperatures.push(temperatures[i]);
        } else if (semiDailyForecast[i].name.includes("Night")) {
            nightTemperatures.push(temperatures[i]);
        } else {
            dayTemperatures.push(temperatures[i]);
        }
    }
    let canvas = document.getElementById("semi_daily_forecast_graph");
    let chart = new Chart(canvas, {
        type: "line",
        data: {
            labels: names,
            datasets: [
                {
                    label: "Daytime Temperature (\u00B0F)",
                    data: dayTemperatures,
                    backgroundColor: "white",
                    borderColor: "red",
                    tension: 0.1,
                },
                {
                    label: "Nighttime Temperature (\u00B0F)",
                    data: nightTemperatures,
                    backgroundColor: "white",
                    borderColor: "blue",
                    tension: 0.1,
                },
            ],
        },
        options: {
            elements: {
                point: {
                    radius: 0,
                },
            },
        },
    });
}

function getTime(timeData) {
    let match = (new Date(timeData)).toLocaleTimeString().match(/(\d+\:\d+)\:\d+ (\w+)/);
    return match[1].concat(" ", match[2]);
}

function getRelativeHumidity(relativeHumidityData) {
    return Math.round(relativeHumidityData).toString().concat(" %");
}

function getVisibility(visibilityData, visibilityUnitsData) {
    let visibility = parseInt(visibilityData);
    let visibilityUnits = getUnits(visibilityUnitsData);
    if (visibilityUnits == "m") {
        visibility /= 1000;
        visibilityUnits = "km";
        if (getUnitSystem() == "imperial") {
            visibility = convertKmToMi(visibility);
            visibilityUnits = "mi";
        }
    }
    visibility = visibility.toFixed(2).toString().concat(" ", visibilityUnits);
    return visibility;
}

function getPressure(pressureData, pressureUnitsData) {
    let pressure = parseInt(pressureData);
    let pressureUnits = getUnits(pressureUnitsData);
    if (pressureUnits == "Pa") {
        pressure /= 1000;
        pressureUnits = "kPa";
    }
    pressure = Math.round(pressure).toString().concat(" ", pressureUnits);
    return pressure;
}

function getTemperature(temperatureData, temperatureUnitsData) {
    let temperature = temperatureData;
    let temperatureUnits = getUnits(temperatureUnitsData);
    temperatureUnits = (temperatureUnits == "degC" || temperatureUnits == "C") ? "\u00B0C" : "\u00B0F";
    let unitSystem = getUnitSystem();
    if (unitSystem == "metric" && temperatureUnits == "\u00B0F") {
        temperature = convertFToC(temperature);
        temperatureUnits = "\u00B0C";
    } else if (unitSystem == "imperial" && temperatureUnits == "\u00B0C") {
        temperature = convertCToF(temperature);
        temperatureUnits = "\u00B0F";
    }
    temperature = Math.round(temperature).toString().concat(" ", temperatureUnits);
    return temperature;
}

function getWindVelocity(windSpeedData, windDirectionData, windSpeedUnitsData) {
    let windSpeed = windSpeedData;
    let windSpeedUnits = getUnits(windSpeedUnitsData);
    windSpeedUnits = (windSpeedUnitsData == "km_h-1" || windSpeedUnitsData == "kph") ? "km/h" : "mi/h";
    let unitSystem = getUnitSystem();
    if (unitSystem == "metric" && windSpeedUnits == "mi/h") {
        windSpeed = convertMiToKm(windSpeed);
        windSpeedUnits = "km/h";
    } else if (unitSystem == "imperial" && windSpeedUnits == "km/h") {
        windSpeed = convertKmToMi(windSpeed);
        windSpeedUnits = "mi/h";
    }
    let windDirection = typeof(windDirectionData) == "string" ? windDirectionData : getCompassDirection(windDirectionData);
    let windVelocity = Math.round(windSpeed).toString().concat(" ", windSpeedUnits, " ", windDirection);
    return windVelocity;
}

function snakeCase(str) {
    s = "";
    for (let i = 0; i < str.length; i++) {
        if (isCapitalized(str[i]) || (!isNaN(parseInt(str[i])) && i > 0 && isNaN(parseInt(str[i - 1])) && str[i - 1] != "." && i < str.length - 1)) {
            s = s.concat("_");
        }
        if (isCapitalized(str[i])) {
            s = s.concat(str[i].toLowerCase());
        } else {
            s = s.concat(str[i]);
        }
    }
    return s;
}

function isCapitalized(s) {
    if (s == s.toUpperCase()) {
        return true;
    } else {
        return false;
    }
}

function capitalize(str) {
    return str[0].toUpperCase().concat(str.slice(1));
}

function camelCase(str) {
    lst = str.split("_");
    return lst[0].concat(lst.slice(1).reduce((str, s) => str.concat(capitalize(s)), ""));
}

function getUnits(data) {
    return data.match(/wmoUnit\:(.*)/)?.[1] ?? data;
}

function convertMiToKm(num_miles) {
    let num_kilometers = num_miles * 1.6093;
    return num_kilometers;
}

function convertKmToMi(num_kilometers) {
    let num_miles = num_kilometers * 0.6214;
    return num_miles;
}

function convertCToF(temperature) {
    temperature = temperature * 9 / 5 + 32;
    return temperature;
}

function convertFToC(temperature) {
    temperature = (temperature - 32) * 5 / 9;
    return temperature;
}

function getCompassDirection(directionDegrees) {
    directionDegrees = parseInt(directionDegrees);
    let compassDirection = "";
    if (directionDegrees == 0) {
        compassDirection = "E";
    } else if (directionDegrees > 0 && directionDegrees < 90) {
        compassDirection = "NE";
    } else if (directionDegrees == 90) {
        compassDirection = "N";
    } else if (directionDegrees > 90 && directionDegrees < 180) {
        compassDirection = "NW";
    } else if (directionDegrees == 180) {
        compassDirection = "W";
    } else if (directionDegrees > 180 && directionDegrees < 270) {
        compassDirection = "SW";
    } else if (directionDegrees == 270) {
        compassDirection = "S";
    } else if (directionDegrees > 270 && directionDegrees < 360) {
        compassDirection = "SE";
    }
    return compassDirection;
}

async function getCurrentPosition() {
    let geolocationPosition = await new Promise(resolve => navigator.geolocation.getCurrentPosition(resolve));
    let coordinates = {
        latitude: geolocationPosition.coords.latitude,
        longitude: geolocationPosition.coords.longitude,
    }
    return coordinates;
}

function fillDataInContainer(container, data, textID="", textClass=null, textElement="p") {
    let text = document.createElement(textElement);
    text.id = textID;
    if (textClass) {
        text.classList.add(textClass);
    }
    text.innerText = data;
    container.appendChild(text);
}

async function main() {
    let currentPosition = await getCurrentPosition();
    let gridAndLocation = await getGridAndLocation(currentPosition);
    let grid = gridAndLocation[0];
    let location = gridAndLocation[1];
    fillDataInContainer(document.getElementById("location_container"), location, "location_text", null, "h3");
    let closestStation = await getClosestStation(grid, currentPosition);
    getLatestObservation(closestStation)
    .then(latestObservation => fillLatestObservationData(latestObservation))
    .catch(e => console.log(e));
    getHourlyForecast(grid)
    .then(hourlyForecast => {
        drawHourlyForecastGraph(hourlyForecast);
        fillHourlyForecastData(hourlyForecast);
    })
    .catch(e => console.log(e));
    getSemiDailyForecast(grid)
    .then(semiDailyForecast => {
        drawSemiDailyForecastGraph(semiDailyForecast);
        fillSemiDailyForecastData(semiDailyForecast);
    })
    .catch(e => console.log(e));
}

main();
