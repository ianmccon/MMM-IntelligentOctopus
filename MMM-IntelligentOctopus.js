//MMM-IntelligentOctopus.js:

/* Magic Mirror
        * Module: MMM-IntelligentOctopus
        *
        * By Ian McConachie
        *
        * Built on MMM-Octomon
        * By Chris Thomas
        * MIT Licensed.
        */

Module.register("MMM-IntelligentOctopus", {
        // Default module config.
        defaults: {
                api_key: "",
                elec_mpan: '',
                elec_serial: '',
                gas_mprn: '',
                gas_serial: '',
                updateInterval: 60000 * 60,
                displayDays: 7,
                elecMedium: 10,
                elecHigh: 20,
                elecCostKWHPeak: 0.3572,
                elecCostKWHoffPeak: 0.1372,
                elecPeakStartTime: '05:30',
                elecPeakEndTime: '23:30',
                elecCostSC: 0.25,
                gasMedium: 0.5,
                gasHigh: 1,
                gasCostKWH: 0.0331,
                gasCostSC: 0.168,
                gasMeterSMETSType: 2,
                decimalPlaces: 2,
                showUpdateTime: true,
                retryDelay: 5000,
                animationSpeed: 2000,
        },

        start: function() {
                Log.log("start()");

                var self = this;
                var elecDataRequest = null;
                var gasDataRequest = null;

                this.config.elecApiUrl = 'https://api.octopus.energy/v1/electricity-meter-points/' + this.config.elec_mpan + '/meters/' + this.config.elec_serial + '/consumption/';
                this.config.gasApiUrl = 'https://api.octopus.energy/v1/gas-meter-points/' + this.config.gas_mprn + '/meters/' + this.config.gas_serial + '/consumption/?group_by=day';


                this.elecLoaded = false;
                this.gasLoaded = false;

                this.getElecData(2);
                this.getGasData(2);

                setInterval(function() {
                        self.getElecData(2);
                        self.getGasData(2);
                }, this.config.updateInterval);

        },

        getElecData: function(retries) {
                Log.log("getElecData(retries=" + retries + ")");

                var self = this;

                var hash = btoa(this.config.api_key + ":");

                // Get date string 7 days from now
                // var dateFormat = require('dateformat');

                const startingDate = new Date();
                const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7));


                if (this.config.elecApiUrl != "") {
                        var elecDataRequest = new XMLHttpRequest();
                        elecDataRequest.open("GET", this.config.elecApiUrl + "?page_size=+" + ((this.config.displayDays + 1) * 48), true);
                        elecDataRequest.setRequestHeader("Authorization", "Basic " + hash);
                        elecDataRequest.onreadystatechange = function() {
                                Log.log("getElecData() readyState=" + this.readyState);
                                if (this.readyState === 4) {
                                        Log.log("getElecData() status=" + this.status);
                                        if (this.status === 200) {
                                                self.processElecData(JSON.parse(this.response));
                                                retries = 0;
                                        } else if (this.status === 401) {
                                                self.elecLoaded = false;
                                                self.updateDom(self.config.animationSpeed);
                                                Log.error(self.name, "getElecData() 401 error. status=" + this.status);
                                        } else {
                                                self.elecLoaded = false;
                                                self.updateDom(self.config.animationSpeed);
                                                Log.error(self.name, "getElecData() Could not load data. status=" + this.status);
                                        }

                                        if (retries > 0) {
                                                retries = retries - 1;
                                                self.scheduleElecRetry(retries);
                                        }
                                }
                        };
                        elecDataRequest.send();
                }

        },

        getGasData: function(retries) {
                Log.log("getGasData(retries=" + retries + ")");

                var self = this;

                var hash = btoa(this.config.api_key + ":");

                if (this.config.gasApiUrl != "") {
                        var gasDataRequest = new XMLHttpRequest();
                        gasDataRequest.open("GET", this.config.gasApiUrl, true);
                        gasDataRequest.setRequestHeader("Authorization", "Basic " + hash);
                        gasDataRequest.onreadystatechange = function() {
                                Log.log("getGasData() readyState=" + this.readyState);
                                if (this.readyState === 4) {
                                        Log.log("getGasData() status=" + this.status);
                                        if (this.status === 200) {
                                                self.processGasData(JSON.parse(this.response));
                                                retries = 0;
                                        } else if (this.status === 401) {
                                                self.gasLoaded = false;
                                                self.updateDom(self.config.animationSpeed);
                                                Log.error(self.name, "getGasData() 401 error. " + this.status);
                                        } else {
                                                self.gasLoaded = false;
                                                self.updateDom(self.config.animationSpeed);
                                                Log.error(self.name, "getGasData() Could not load data. status=" + this.status);
                                        }

                                        if (retries > 0) {
                                                retries = retries - 1;
                                                self.scheduleGasRetry(retries);
                                        }
                                }
                        };
                        gasDataRequest.send();
                }
        },

        scheduleElecRetry: function(retries) {
                Log.log("scheduleElecRetry() retries=" + retries);
                var self = this;
                setTimeout(function() {
                        self.getElecData(retries);
                }, self.config.retryDelay);
        },

        scheduleGasRetry: function(retries) {
                Log.log("scheduleGasRetry() retries=" + retries);
                var self = this;
                setTimeout(function() {
                        self.getGasData(retries);
                }, self.config.retryDelay);
        },

        // Override dom generator.
        getDom: function() {
                Log.log("getDom()");
                var wrapper = document.createElement("div");

                var errors = "";
                if ((this.config.gasApiUrl === "" || typeof this.config.gasApiUrl === 'undefined') && (this.config.elecApiUrl === "" || typeof this.config.elecApiUrl === 'undefined')) {
                        errors = errors + "Both gasApiUrl and elecApiUrl not set in config. At least one required.</br>";
                }

                if (this.config.api_key === "") {
                        errors = errors + "API Key (api_key) not set in config.</br>";
                }

                if (errors != "") {
                        wrapper.innerHTML = errors;
                        wrapper.className = "dimmed light small";
                        return wrapper;
                }

                if (this.elecLoaded == false && this.gasLoaded == false) {
                        wrapper.innerHTML = "Querying Server...";
                        wrapper.className = "dimmed light small";
                        return wrapper;
                }

                var table = document.createElement("table");
                table.className = "small";

                var headerrow = document.createElement("tr");

                var headerdatelabel = document.createElement("td");
                headerdatelabel.innerHTML = ""; //or you could display a date column header: "<span class=\"fa fa-calendar-alt small\"></span> Date";
                headerdatelabel.className = "small";
                headerdatelabel.style.verticalAlign = "top";
                headerdatelabel.style.textAlign = "center";

                var headereleclabel = document.createElement("td");
                headereleclabel.innerHTML = "<span class=\"fa fa-plug small\"></span> Elec";
                headereleclabel.className = "small";
                headereleclabel.style.verticalAlign = "top";
                headereleclabel.style.textAlign = "center";

                var headergaslabel = document.createElement("td");
                headergaslabel.innerHTML = "<span class=\"fa fa-burn small\"></span> Gas";
                headergaslabel.className = "small";
                headergaslabel.style.verticalAlign = "top";
                headergaslabel.style.textAlign = "center";


                headerrow.appendChild(headerdatelabel);
                if (this.elecDataRequest) headerrow.appendChild(headereleclabel);
                if (this.gasDataRequest) headerrow.appendChild(headergaslabel);
                table.appendChild(headerrow);

                var i = 0;
                var intLoop = 0;
                var intDays = this.config.displayDays; //how many days of history to show
                var dteLoop = new Date(); //start today and go backwards
                if (true) {
                        //if true, actually, start from first day's worth of available data
                        //the api only seems to be able to return data from two days ago
                        //so this skips over 'today' and 'yesterday' that have no displayable data yet

                        var elecdate;
                        if (this.elecDataRequest) {
                                if (typeof this.elecDataRequest[0] !== 'undefined') {
                                        elecdate = new Date(this.elecDataRequest[0].date);
                                }
                        }
                        var gasdate;
                        if (this.gasDataRequest) {
                                if (typeof this.gasDataRequest.results[0] !== 'undefined') {
                                        gasdate = new Date(this.gasDataRequest.results[0].interval_start);
                                }
                        }

                        if (typeof elecdate == 'undefined') {
                                elecdate = new Date();
                        }
                        if (typeof gasdate == 'undefined') {
                                gasdate = new Date();
                        }

                        //which is the closest date to today? start the loop there.
                        if (elecdate <= gasdate) {
                                dteLoop = elecdate;
                        } else {
                                dteLoop = gasdate;
                        }
                }

                var strDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                for (intLoop = 0; intLoop < intDays; intLoop++) {
                        var thisrow = document.createElement("tr");

                        var thisdatelabel = document.createElement("td");
                        thisdatelabel.innerHTML = strDays[dteLoop.getDay()] + " " + dteLoop.toLocaleDateString();
                        thisdatelabel.className = "small";

                        var thiseleclabel = document.createElement("td");
                        thiseleclabel.innerHTML = "---";
                        thiseleclabel.className = "small";
                        thiseleclabel.style.textAlign = "center";

                        var thisgaslabel = document.createElement("td");
                        thisgaslabel.innerHTML = "---";
                        thisgaslabel.className = "small";
                        thisgaslabel.style.textAlign = "center";

                        //we're looking for gas and elec results for this day
                        if (this.elecDataRequest) {
                                for (i = 0; i < intDays; i++) {
                                        if (typeof this.elecDataRequest[i] !== 'undefined') {


                                                        var edate = new Date(this.elecDataRequest[i].date);
                                                        if (edate.toLocaleDateString() == dteLoop.toLocaleDateString()) {

                                                                var strCol = "color:green"; //could be green
                                                                var totalIntVal = this.elecDataRequest[i].periodTotalKwh.toFixed(this.config.decimalPlaces);
                                                                var peakIntVal = this.elecDataRequest[i].peakConsumption.toFixed(this.config.decimalPlaces);
                                                                var offpeakIntVal = this.elecDataRequest[i].offpeakConsumption.toFixed(this.config.decimalPlaces);
                                                                if (totalIntVal >= this.config.elecMedium) strCol = "color:orange";
                                                                if (totalIntVal >= this.config.elecHigh) strCol = "color:red";

                                                                strTotalUse = totalIntVal + " kWh";
                                                                strCost = "";
                                                                if (this.config.elecCostKWHPeak > 0 && this.config.elecCostKWHoffPeak > 0)
                                                                        strCost = "£" + (Math.round(((offpeakIntVal * this.config.elecCostKWHoffPeak) + (peakIntVal * this.config.elecCostKWHPeak) + this.config.elecCostSC) * 100) / 100).toFixed(2);
                                                                //display electricity energy usage and cost here
                                                                thiseleclabel.innerHTML = "&nbsp;&nbsp;<span style=\"" + strCol + "\">" + offpeakIntVal + "/" + peakIntVal + " (" + strTotalUse + ") " + strCost + "</span>";
                                                                thiseleclabel.style.textAlign = "right";

                                                        }

                                        }
                                }
                        }

                        if (this.gasDataRequest) {
                                for (i = 0; i < intDays + 1; i++) {
                                        if (typeof this.gasDataRequest.results[i] !== 'undefined') {
                                                var edate = new Date(this.gasDataRequest.results[i].interval_start);
                                                if (edate.toLocaleDateString() == dteLoop.toLocaleDateString()) {

                                                        var strCol = "color:green"; //could be green
                                                        var consumption = this.gasDataRequest.results[i].consumption;
                                                        if (this.config.gasMeterSMETSType == '2')
                                                                var intVal = (this.gasDataRequest.results[i].consumption * 1.02264 * 38.1 / 3.6).toFixed(this.config.decimalPlaces);
                                                        else {
                                                                var intVal = this.gasDataRequest.results[i].consumption.toFixed(this.config.decimalPlaces);
                                                        }
                                                        if (consumption >= this.config.gasMedium) strCol = "color:orange";
                                                        if (consumption >= this.config.gasHigh) strCol = "color:red";

                                                        usage = this.gasDataRequest.results[i].consumption.toFixed(this.config.decimalPlaces);
                                                        if (this.config.gasMeterSMETSType == '2')
                                                                strUse = usage + " m<sup>3</sup>";
                                                        else {
                                                                strUse = usage + "  kwh";
                                                        }
                                                        strCost = "";
                                                        if (this.config.gasCostKWH > 0)
                                                                strCost = "£" + (Math.round(((intVal * this.config.gasCostKWH) + this.config.gasCostSC) * 100) / 100).toFixed(2);

                                                        //display gas energy usage and cost here
                                                        thisgaslabel.innerHTML = "&nbsp;&nbsp;<span style=\"" + strCol + "\">" + strUse + " " + strCost + "</span>";
                                                        thisgaslabel.style.textAlign = "right";

                                                }
                                        }
                                }
                        }

                        thisrow.appendChild(thisdatelabel);
                        if (this.elecDataRequest) thisrow.appendChild(thiseleclabel);
                        if (this.gasDataRequest) thisrow.appendChild(thisgaslabel);

                        table.appendChild(thisrow);

                        dteLoop.setDate(dteLoop.getDate() - 1); //go back to the next day
                }

                wrapper.appendChild(table);

                return wrapper;
        },

        getHeader: function() {
                var adate = new Date();
                //Log.log("getHeader() " + adate.toLocaleTimeString());

                if (this.config.showUpdateTime == true) {
                        return this.data.header + " " + adate.toLocaleTimeString();
                } else {
                        return this.data.header;
                }
        },

        processElecData: function(data) {
                Log.log("processElecData()");
                var self = this;

                // this gives an object with dates as keys
                const groups = data.results.reduce((groups, consumption) => {
                  const date = consumption.interval_start.split('T')[0];
                  if (!groups[date]) {
                    groups[date] = [];
                  }
                  groups[date].push(consumption);
                  return groups;
                }, {});


                // Edit: to add it in the array format instead
                const groupArrays = Object.keys(groups).map((date) => {
                  return {
                    date,
                    consumption: groups[date]
                  };
                });

                // const processedDailyData = Object.keys(groupArrays).map((date) => {
                const processedDailyData = [];
                for (i = 0; i < groupArrays.length - 1; i++) {
                        const date = groupArrays[i].date;
                        if (groupArrays[i].consumption.length == 48) {
                                dailyConsumption = self.processDailyConsumption(groupArrays[i].consumption);
                                dailyConsumption["date"] = date;
                                processedDailyData.push(dailyConsumption);
                        }
                };


                this.elecDataRequest = processedDailyData;
                this.elecLoaded = true;
                self.updateDom(self.config.animationSpeed);

        },

        processDailyConsumption: function(raw) {
                var self = this;

                // the api returns data slightly outside of the 24h period we're interested in
                const startDateTime = new Date(raw.map((el) => el.interval_start)[0]);
                startDateTime.setHours(0, 0, 0);
                const endDateTime = new Date(startDateTime.getTime() + ( 3600 * 1000 * 24))
                endDateTime.setHours(0, 0, 0);
                // we just want the data between startDateTime and endDateTime, throw away the rest
                const dataSet = raw.filter((el) => {
                        if (
                                new Date(el.interval_start) < endDateTime &&
                                new Date(el.interval_end) > startDateTime
                        ) {
                                return el;
                        }
                });

                const periodTotalKwh = dataSet
                        .map((el) => el.consumption)
                        .reduce((acc = 0, cur) => {
                                return acc + cur;
                        });

                const peakStartTime = this.config.elecPeakStartTime;
                const peakEndTime = this.config.elecPeakEndTime;
                // sum the values between the hours of 05:30 and 23:30
                const peakConsumption = dataSet
                        .map((el) => {
                                const peakStartPeriod = new Date(el.interval_start);
                                peakStartPeriod.setHours(peakStartTime.split(":")[0], peakStartTime.split(":")[1], 0);
                                const peakEndPeriod = new Date(el.interval_start)
                                peakEndPeriod.setHours(peakEndTime.split(":")[0], peakEndTime.split(":")[1], 0);
                                const startTime = new Date(el.interval_start);
                                const endTime = new Date(el.interval_end);

                                if (startTime >= peakStartPeriod && endTime <= peakEndPeriod) {
                                        return el.consumption;
                                }
                                return 0;
                        })
                        .reduce((acc = 0, cur) => {
                                return acc + cur;
                        });

                // subtract peakPeriod from total consumption to give us rest of usage
                const offpeakConsumption = periodTotalKwh - peakConsumption;

                const data = {
                        periodTotalKwh,
                        peakConsumption,
                        offpeakConsumption,
                };
                return(data);


        },

        processGasData: function(data) {
                Log.log("processGasData()");
                var self = this;
                this.gasDataRequest = data;
                this.gasLoaded = true;
                self.updateDom(self.config.animationSpeed);
        },


        groupBy: function(key) {
          return function group(array) {
            return array.reduce((acc, obj) => {
              const property = obj[key];
              acc[property] = acc[property] || [];
              acc[property].push(obj);
              return acc;
            }, {});
          };
        },



});
