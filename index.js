let imageNames = {
    "cloudyDay": "cloudy.png",
    "cloudyNight": "night_cloudy.png",
    "fog": "fog.png",
    "lightning": "lightning.png",
    "clearDay": "sunny.png",
    "clearNight": "night_clear.png",
    "sunny": "sunny.png",
    "partlyCloudy": "partly_cloudy.png",
    "rainLikely": "rain_likely.png",
    "rain": "rain.png",
    "snow": "snow.png",
    "thunderstorms": "thunderstorm.png",
    "windy": "windy.png",
    "winteryMix": "winter_mix.png",
}

function getImageName(isDaytime, text) {
    let imageName = null;
    if (text.includes("Fog")) {
        imageName = imageNames["fog"];
    } else if (text.includes("Thunderstorm")) {
        imageName = imageNames["thunderstorms"];
    } else if (text.includes("Lightning")) {
        imageName = imageNames["lightning"];
    } else if (text.includes("Rain")) {
        imageName = imageNames["rain"];
    } else if (text.includes("Snow")) {
        imageName = imageNames["snow"];
    } else if (text.includes("Wintery Mix")) {
        imageName = imageNames["winteryMix"];
    } else if (text.includes("Wind")) {
        imageName = imageNames["windy"];
    } else if (text.includes("Clear")) {
        imageName = isDaytime ? imageNames["clearDay"] : imageNames["clearNight"];
    } else if (text.includes("Sunny")) {
        imageName = imageNames["sunny"];
    } else if (text.includes("Partly Cloudy")) {
        imageName = isDaytime ? imageNames["partlyCloudy"] : imageNames["cloudyNight"];
    } else if (text.includes("Cloudy")) {
        imageName = isDaytime ? imageNames["cloudyDay"] : imageNames["cloudyNight"];
    }
    imageName = imageName ? "images/".concat(imageName) : imageName;
    return imageName;
}

function getUnitSystem() {
    return "imperial";
}

async function getGridAndLocation(coordinates) {
    let data = await fetch(`https://api.weather.gov/points/${coordinates["latitude"]},${coordinates["longitude"]}`)
        .then(response => response.json())
        .catch(e => console.error(e));
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
                timeZone: stationData["properties"]["timeZone"],
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
    let semiDailyForecastData = await fetch(`https://api.weather.gov/gridpoints/${grid.id}/${grid.x},${grid.y}/forecast`)
        .then(response => response.json())
        .catch(e => console.error(e));
    let periodsData = semiDailyForecastData?.["properties"]?.["periods"];
    if (periodsData) {
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
    } else {
        throw "Invalid semi-daily forecast returned";
    }
}

function getDayOfWeek(data) {
    return (new Date(data)).toLocaleDateString(undefined, {weekday: "long"});
}

async function getHourlyForecast(grid) {
    let hourlyForecastData = await fetch(`https://api.weather.gov/gridpoints/${grid.id}/${grid.x},${grid.y}/forecast/hourly`)
        .then(response => response.json())
        .catch(e => console.error(e));
    let periodsData = hourlyForecastData?.["properties"]?.["periods"];
    if (periodsData) {
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
    } else {
        throw "Invalid hourly forecast returned";
    }
}

function fillLatestObservationData(latestObservation, station) {
    let conditionsGrid = document.getElementById("conditions_grid");
    let currentMainDataCntr = document.getElementById("current_main_data_container");
    let leafChildren = Array.from(conditionsGrid.children).concat(Array.from(currentMainDataCntr.children));
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
    if (station.timeZone) {
        let match = (new Date()).toLocaleString("en-us", {timeZone: station.timeZone})?.match(/(\d{1,2}\:\d{2})\:\d{2} ((?:A|P)M)/);
        if (match) {
            let hoursAndMin = match[1];
            let dayPeriod = match[2];
            let image = document.createElement("img");
            image.id = "latest_observation_image";
            image.src = getImageName(isDayHourly(hoursAndMin.concat(" ", dayPeriod)), latestObservation.description);
            image.classList.add("latest_observation_image");
            document.getElementById("current_conditions_image_container").appendChild(image);
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
        let dataAndImageContainer = document.createElement("div");
        dataAndImageContainer.classList.add("hourly_forecast_data_and_image");
        dataAndImageContainer.appendChild(weatherDataContainer);
        let imageContainer = document.createElement("div");
        imageContainer.classList.add("hourly_forecast_image_container");
        let image = document.createElement("img");
        image.src = hourlyForecast[i].startTime ? getImageName(isDayHourly(hourlyForecast[i].startTime), hourlyForecast[i].description) : "";
        image.classList.add("hourly_forecast_image");
        imageContainer.appendChild(image);
        dataAndImageContainer.appendChild(imageContainer);
        periodContainer.appendChild(dataAndImageContainer);
        hourlyForecastContainer.appendChild(periodContainer);
        if (i != hourlyForecast.length - 1) {
            let hr = document.createElement("hr");
            hr.classList.add("period_divider");
            hourlyForecastContainer.appendChild(hr);
        }
    }
}

function isDayHourly(startTime) {
    let match = startTime.match(/(\d{1,2})\:\d{2} ((A|P)M)/);
    let hour = parseInt(match[1]);
    let dayPeriod = match[2];
    if ((hour >= 6 && hour <= 11 && dayPeriod == "AM") || (((hour == 12) || (hour >= 1 && hour <= 5)) && dayPeriod == "PM")) {
        return true;
    } else {
        return false;
    }
}

function drawHourlyForecastGraph(hourlyForecast, all=true, smoothness=0) {
    if (!all) {
        hourlyForecast = hourlyForecast.slice(0, 24);
    }
    let startTimes = hourlyForecast.map(period => period.dayOfWeek.concat(" ", period.startTime));
    let temperatures = hourlyForecast.map(period => period.temperature.split(" ")[0]);
    let canvas = document.getElementById("hourly_forecast_graph");
    Chart.getChart("hourly_forecast_graph")?.destroy();
    let chart = new Chart(canvas, {
        type: "line",
        data: {
            labels: startTimes,
            datasets: [{
                label: "Temperature (\u00B0F)",
                data: temperatures,
                backgroundColor: "white",
                borderColor: "green",
                tension: smoothness,
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
        let dataAndImageContainer = document.createElement("div");
        dataAndImageContainer.classList.add("semi_daily_forecast_data_and_image");
        dataAndImageContainer.appendChild(weatherDataContainer);
        let imageContainer = document.createElement("div");
        imageContainer.classList.add("semi_daily_forecast_image_container");
        let image = document.createElement("img");
        image.src = semiDailyForecast[i].description ? getImageName(isDaySemiDaily(semiDailyForecast[i].name), semiDailyForecast[i].description) : "";
        image.classList.add("semi_daily_forecast_image");
        imageContainer.appendChild(image);
        dataAndImageContainer.appendChild(imageContainer);
        periodContainer.appendChild(dataAndImageContainer);
        semiDailyForecastContainer.appendChild(periodContainer);
        if (i != semiDailyForecast.length - 1) {
            let hr = document.createElement("hr");
            hr.classList.add("period_divider");
            semiDailyForecastContainer.appendChild(hr);
        }
    }
}

function isDaySemiDaily(text) {
    return (text.includes("Night") || text.includes("night") || text.includes("evening")) ? false : true;
}

function getPreviousDayOfWeek(dayOfWeek) {
    let daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let index = daysOfWeek.indexOf(dayOfWeek);
    if (index == -1) {
        throw "Invalid day of week.";
    }
    let previousDayOfWeek = index == 0 ? daysOfWeek[daysOfWeek.length - 1] : daysOfWeek[index - 1];
    return previousDayOfWeek;
}

function getNextDayOfWeek(dayOfWeek) {
    let daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let index = daysOfWeek.indexOf(dayOfWeek);
    if (index == -1) {
        throw "Invalid day of week.";
    }
    let nextDayOfWeek = index == daysOfWeek.length - 1 ? daysOfWeek[0] : daysOfWeek[index + 1];
    return nextDayOfWeek;
}

function drawSemiDailyForecastGraph(semiDailyForecast) {
    let daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let s = null;
    let dayOfWeek = null;
    let dayOfWeekIndex = null;
    let night = false;
    for (let i = 0; i < semiDailyForecast.length; i++) {
        if (semiDailyForecast[i].name.length > 0) {
            s = semiDailyForecast[i].name.split();
            if (daysOfWeek.indexOf(s[0]) != -1) {
                dayOfWeek = s[0];
                dayOfWeekIndex = i;
                night = s.length > 1 && s[1] == "Night" ? true : false;
                break;
            }
        }
    }
    if (dayOfWeek == null) {
        throw "No legal weekday names found in semi-daily forecast data.";
    }
    let names = semiDailyForecast.map(period => period.name);
    for (let dow = dayOfWeek, n = night, i = dayOfWeekIndex - 1; i >= 0; i--) {
        dow = n ? dow : getPreviousDayOfWeek(dow);
        n = !n;
        names[i] = n ? dow + " Night" : dow;
    }
    for (let dow = dayOfWeek, n = night, i = dayOfWeekIndex + 1; i < names.length; i++) {
        dow = n ? getNextDayOfWeek(dow) : dow;
        n = !n;
        names[i] = n ? dow + " Night" : dow;
    }
    let temperatures = semiDailyForecast.map(period => period.temperature.split(" ")[0]);
    let dayTemperatures = [];
    let nightTemperatures = [];
    for (let i = 0; i < temperatures.length; i++) {
        if (i == 0) {
            if (names[i].includes("Night")) {
                dayTemperatures.push(null);
                nightTemperatures.push(temperatures[i]);
            } else {
                dayTemperatures.push(temperatures[i]);
            }
        } else {
            if (names[i].includes("Night")) {
                nightTemperatures.push(temperatures[i]);
            } else {
                dayTemperatures.push(temperatures[i]);
            }
        }
    }
    names = names[0].includes("Night") ? [names[0].split(" ")[0]].concat(names.filter(name => !name.includes("Night"))) : names.filter(name => !name.includes("Night"));
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

async function displayForecast(position) {
    document.getElementById("weather_forecast_container").hidden = false;
    let gridAndLocation = await getGridAndLocation(position);
    let grid = gridAndLocation[0];
    let location = gridAndLocation[1];
    fillDataInContainer(document.getElementById("location_container"), location, "location_text", null, "h3");
    let closestStation = await getClosestStation(grid, position);
    getLatestObservation(closestStation)
    .then(latestObservation => fillLatestObservationData(latestObservation, closestStation))
    .catch(e => console.log(e));
    getHourlyForecast(grid)
    .then(hourlyForecast => {
        sessionStorage["hourlyForecast"] = JSON.stringify(hourlyForecast);
        drawHourlyForecastGraph(hourlyForecast, false, 0.1);
        fillHourlyForecastData(hourlyForecast);
        document.getElementById("hourly_forecast_container").hidden = false;
    })
    .catch(e => {
        console.error(e);
        document.getElementById("hourly_forecast_error_container").hidden = false;
    });
    getSemiDailyForecast(grid)
    .then(semiDailyForecast => {
        sessionStorage["semiDailyForecast"] = JSON.stringify(semiDailyForecast);
        drawSemiDailyForecastGraph(semiDailyForecast);
        fillSemiDailyForecastData(semiDailyForecast);
        document.getElementById("semi_daily_forecast_container").hidden = false;
    })
    .catch(e => {
        console.error(e);
        document.getElementById("semi_daily_forecast_error_container").hidden = false;
    });
}

function clearData() {
    let locationContainer = document.getElementById("location_container");
    while (locationContainer?.firstChild) {
        locationContainer.removeChild(locationContainer.firstChild);
    }
    let currentConditionsImageCntr = document.getElementById("current_conditions_image_container");
    while (currentConditionsImageCntr?.firstChild) {
        currentConditionsImageCntr.removeChild(currentConditionsImageCntr.firstChild);
    }
    let currentConditionsContainer = document.getElementById("current_conditions_container");
    if (currentConditionsContainer) {
        let elements = currentConditionsContainer.getElementsByTagName("span");
        for (element of elements) {
            element.innerText = "";
        }
    }
    document.getElementById("hourly_forecast_container").hidden = true;
    Chart.getChart("hourly_forecast_graph")?.destroy();
    let hourlyForecastDataCntr = document.getElementById("hourly_forecast_data_container");
    while (hourlyForecastDataCntr?.firstChild) {
        hourlyForecastDataCntr.removeChild(hourlyForecastDataCntr.firstChild);
    }
    document.getElementById("hourly_forecast_error_container").hidden = true;
    document.getElementById("semi_daily_forecast_container").hidden = true;
    Chart.getChart("semi_daily_forecast_graph")?.destroy();
    let semiDailyForecastDataCntr = document.getElementById("semi_daily_forecast_data_container");
    while (semiDailyForecastDataCntr?.firstChild) {
        semiDailyForecastDataCntr.removeChild(semiDailyForecastDataCntr.firstChild);
    }
    document.getElementById("semi_daily_forecast_error_container").hidden = true;
}

function lockButtons() {
    document.getElementById("coordinates_input_button").disabled = true;
    document.getElementById("current_location_input_button").disabled = true;
}

function unlockButtons() {
    document.getElementById("coordinates_input_button").disabled = false;
    document.getElementById("current_location_input_button").disabled = false;
}

function main() {
    document.getElementById("coordinates_input_button").addEventListener("click", ((event) => {
        lockButtons();
        clearData();
        let data = document.getElementById("coordinates_input").value.split(",").map(x => parseInt(x.trim()));
        let position = {
            "latitude": data[0],
            "longitude": data[1],
        }
        displayForecast(position)
        .then(() => unlockButtons())
        .catch(e => console.log(e));
    }));
    document.getElementById("current_location_input_button").addEventListener("click", ((event) => {
        lockButtons();
        clearData();
        getCurrentPosition()
        .then(currentPosition => displayForecast(currentPosition))
        .then(() => unlockButtons())
        .catch(e => console.log(e));
    }));
    document.getElementById("weather_forecast_container").hidden = true;
    let defaultInput = document.getElementById("default_to_current_location_input");
    defaultInput.addEventListener("click", ((event) => {
        if (event.target.checked) {
            localStorage["defaultToCurrentLocation"] = JSON.stringify(true);
        } else {
            localStorage["defaultToCurrentLocation"] = JSON.stringify(false);
        }
    }));
    document.getElementById("hourly_forecast_graph_selector_24_hour").addEventListener("click", (event => drawHourlyForecastGraph(JSON.parse(sessionStorage["hourlyForecast"]), false, 0.1)));
    document.getElementById("hourly_forecast_graph_selector_week").addEventListener("click", (event => drawHourlyForecastGraph(JSON.parse(sessionStorage["hourlyForecast"]))));
    if (localStorage["defaultToCurrentLocation"] && JSON.parse(localStorage["defaultToCurrentLocation"])) {
        lockButtons();
        clearData();
        defaultInput.checked = true;
        getCurrentPosition()
        .then(currentPosition => displayForecast(currentPosition))
        .then(() => unlockButtons())
        .catch(e => console.log(e));
    }
}

main();
