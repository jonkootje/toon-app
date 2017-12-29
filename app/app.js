var toon = {
    "saveSettings":function(formID) {
        var form = $(formID);
        var data = {
            "endpoint":form.find('input[name="endpoint"]').val(),
            "port":form.find('input[name="port"]').val(),
            "refreshrate":form.find('input[name="refreshrate"]').val()
        };

        if (data.port == '' || data.port == 0) {
            data.port = 80; // DEFAULT PORT
        }
        if (data.refreshrate == '' || data.refreshrate == 0) {
            data.refreshrate = 10; // DEFAULT REFRESH RATE
        }

        window.localStorage.setItem('toon_endpoint', data.endpoint);
        window.localStorage.setItem('toon_port', data.port);
        window.localStorage.setItem('toon_refreshrate', data.refreshrate);

        console.log('Saved settings');

        this.closeSettings();

        $('.connection_status').html('Loading...');
        $('.connection').addClass('loading')
            .removeClass('disconnected')
            .removeClass('connected');

        clearInterval(dashboard.intervalID);
        dashboard.startRefresh();

        return true;
    },
    "getSetting":function(setting) {
        return window.localStorage.getItem('toon_' + setting);
    },
    "openSettings":function() {

        var form = $('#settings_form');
        form.find('input[name="endpoint"]').val(this.getSetting('endpoint'));
        form.find('input[name="port"]').val(this.getSetting('port'));
        form.find('input[name="refreshrate"]').val(this.getSetting('refreshrate'));

        $('#settings').addClass('active');
        $('#main').addClass('disabled');
        return true;
    },
    "closeSettings":function() {
        $('#settings').removeClass('active');
        $('#main').removeClass('disabled');
    },
    "setState":function(state) {
        var states = {
            "comfort": 0, 
            "home": 1,
            "sleep": 2,
            "away": 3
        };
        var changestate = states[state];

        if (typeof(changestate) == 'undefined') {
            console.error('Invalid state change');
            return false;
        } else {

            var url = toon.getSetting('endpoint') + ':' + toon.getSetting('port') + '/happ_thermstat?action=changeSchemeState&state=2&temperatureState=' + changestate;
            
            // Show new state before even requesting
            var lastdata = dashboard.lastData;
            lastdata.activeState = changestate;
            dashboard.fillData(lastdata);
            
            $.ajax({
                "url":url,
                "dataType":"JSON",
                "method":"POST",
                "success":function(resp) {
                    // console.log(resp);
                    console.log('Successfully changed state');
                    dashboard.refresh();
                },
                "failure":function(resp) {
                    console.error('Failure');
                },
                "error":function(resp) {                    
                    console.error('Failure');
                }
            });
        }
    },
    "sendTempOn":null,
    "sendDelay":2000,
    "isIncreasing":false,
    "increaseTemp":function() {
        this.isIncreasing = true;

        var current = parseInt(dashboard.lastData.currentSetpoint);
        current += 50;
        dashboard.lastData.currentSetpoint = String(current);

        dashboard.fillData(dashboard.lastData);

        this.sendTempOn = (new Date()).getTime() + this.sendDelay;
        setTimeout(function() {
            if (toon.sendTempOn < (new Date).getTime()) {
                toon.isIncreasing = false;
                toon.sendTemp();
            }
        }, this.sendDelay + 10);

        $('.tempmonitor_parent').addClass('switch');        
        
        return true;
    },
    "decreaseTemp":function() {
        this.isIncreasing = true;
        
        var current = parseInt(dashboard.lastData.currentSetpoint);
        current -= 50;
        dashboard.lastData.currentSetpoint = String(current);

        dashboard.fillData(dashboard.lastData);

        this.sendTempOn = (new Date()).getTime() + this.sendDelay;
        setTimeout(function() {
            if (toon.sendTempOn < (new Date).getTime()) {
                toon.isIncreasing = false;
                toon.sendTemp();
            }
        }, this.sendDelay + 10);

        $('.tempmonitor_parent').addClass('switch');
        
        return true;
    },
    "sendTemp":function() {
        var temp = dashboard.lastData.currentSetpoint;
        var url = toon.getSetting('endpoint') + ':' + toon.getSetting('port') + '/happ_thermstat?action=setSetpoint&Setpoint=' + temp;

        $('.tempmonitor_parent').removeClass('switch');        

        $.ajax({
            "url":url,
            "dataType":"JSON",
            "method":"POST",
            "success":function(resp) {
                console.log('Successfully changed temperature');
                dashboard.refresh();
            },
            "error":function(resp) {
                console.error('Failed to change temp');
            },
            "failure":function(resp) {                
                console.error('Failed to change temp');
            }
        })
    },
    "toggleProgram":function() {
        var program = parseInt(dashboard.lastData.nextProgram);
        if (program == 1) {
            // ON - TURN OFF
            var url = toon.getSetting('endpoint') + ':' + toon.getSetting('port') + '/happ_thermstat?action=changeSchemeState&state=0';
            dashboard.lastData.nextProgram = -1;
        } else {
            // OFF - TURN ON
            var url = toon.getSetting('endpoint') + ':' + toon.getSetting('port') + '/happ_thermstat?action=changeSchemeState&state=1';
            dashboard.lastData.nextProgram = 1;
        }

        dashboard.fillData(dashboard.lastData);
        $('#comming').html('');

        $.ajax({
            "url":url,
            "dataType":"JSON",
            "method":"POST",
            "success":function(resp) {
                console.log('Successfully toggled program');
                dashboard.refresh();
            },
            "error":function(resp) {
                console.error('Failed to toggle program');
            },
            "failure":function(resp) {                
                console.error('Failed to toggle program');
            }
        });
    }
}

var dashboard = {
    "lastData":{},
    "intervalID":null,
    "startRefresh":function() {
        var rate = toon.getSetting('refreshrate');
        if (rate == null) {
            rate = 10; // DEFAULT RATE
        } else {
            rate = parseInt(rate);
        }

        rate = rate * 1000;

        this.intervalID = setInterval(function() {
            dashboard.refresh();
        }, rate);

        dashboard.refresh();

        return true;
    },
    "refresh":function(forcerefresh) {

        if (typeof(forcerefresh) == 'undefined') {var forcerefresh = false;}

        if (!toon.isIncreasing || forcerefresh) {
            console.log('refreshing');
    
            var url = toon.getSetting('endpoint') + ':' + toon.getSetting('port') + '/happ_thermstat?action=getThermostatInfo';
            // var url = toon.getSetting('endpoint') + '/happ_thermstat?action=getThermostatInfo';
            $.ajax({
                "url":url,
                "method":"GET",
                "data":{},
                "dataType":"JSON",
                "success":function(resp) {
                    $('.connection_status').html('Verbonden');
                    $('.connection').removeClass('loading')
                        .removeClass('disconnected')
                        .addClass('connected');
                    
                        if (!toon.isIncreasing) {
                        dashboard.fillData(resp);
                    }
                    // debugger;
                },
                "failure":function(resp) {
                    console.error('Could not connect');
                    // clearInterval(dashboard.intervalID);
                    // toon.openSettings();
                    dashboard.fillData({
                        "currentTemp":0,
                        "currentSetpoint":0,
                        "activeState":-1,
                        "nextProgram":-1
                    });
                    $('.connection_status').html('Niet verbonden');
                    $('.connection').removeClass('loading')
                        .addClass('disconnected')
                        .removeClass('connected');
                
                },
                "error":function(resp) {
                    console.error('Could not connect');
                    // clearInterval(dashboard.intervalID);
                    // toon.openSettings();
                    dashboard.fillData({
                        "currentTemp":0,
                        "currentSetpoint":0,
                        "activeState":-1,
                        "nextState":-1,
                        "nextTime":-1,
                        "nextProgram":-1
                    });
                    $('.connection_status').html('Niet verbonden');
                    $('.connection').removeClass('loading')
                        .addClass('disconnected')
                        .removeClass('connected');                    
                },
                "timeout":5000
            });
        } else {
            console.log('Skipping refresh, is increasing');
        }
    },
    "fillData":function(data) {
        this.lastData = data;
        console.log('Filling data', data);

        // TEMPERATURE MONITOR CODE
        var currentTemp = String(Math.round(parseInt(data.currentTemp) / 10) / 10).replace('.', ',');
        var currentSetpoint = String(Math.round(parseInt(data.currentSetpoint) / 10) / 10).replace('.', ',');

        $('#current_temp').html(currentTemp);
        $('#target_temp').html(currentSetpoint);

        $('#target_temp')
            .removeClass('less')
            .removeClass('more');
        
        if (parseFloat(currentSetpoint.replace(',', '.')) > parseFloat(currentTemp.replace(',', '.'))) {
            // More
            $('#target_temp').addClass('more');
        } else {
            // Less
            $('#target_temp').addClass('less');
        }

        
        // CURRENT PROGRAM CODE
        var buttons = [
            "comfort",
            "home",
            "sleep",
            "away"
        ];
        var program = parseInt(data.activeState);
        $('.programbtn').removeClass('active');
        if (program !== -1) {
            console.log('.act_' + buttons[program], $('.act_' + buttons[program]));
            $('.act_' + buttons[program]).addClass('active');
        }

        
        
        // NEXT PROGRAM CODE
        if (parseInt(data.nextProgram) == 1) {
            var language = [
                'Comfort',
                'Thuis',
                'Slapen',
                'Weg',
                "Handmatig"
            ];
            if (data.nextState == -1) {
                data.nextState = 4;
            }

            var now = new Date(parseInt(data.nextTime) * 1000);
            var hours = now.getHours();
            var minutes = now.getMinutes();

            if (minutes < 10) {
                var minutes = "0" + String(minutes);
            }

            var time = hours + ':' + minutes;
            if (data.nextTime == -1) {
                time = '--:--';
            }
            var string = 'Om ' + time + ' op ' + language[data.nextState];
            $('#toggleprogram').addClass('active');
        } else {
            var string = 'Programma uit';
            $('#toggleprogram').removeClass('active');
        }
        $('#comming').html(string);


        // BURNER CODE
        if (parseInt(data.burnerInfo) == 1) {
            // Burner is active
            $('#burner').attr('src', 'icon-fire.png');
        } else {
            // Burner is not active
            $('#burner').attr('src', 'icon-fire-off.png');
        }
        
        return true;
    }
}

function initialize() {

    $('.programbtn').click(function() {
        toon.setState(this.dataset.state);
    });
    
    $('.tempchange.increase').click(function() {
        toon.increaseTemp();
    });
    $('.tempchange.decrease').click(function() {
        toon.decreaseTemp();
    });
    $('#toggleprogram').click(function() {
        toon.toggleProgram();
    })

    dashboard.startRefresh();
    return true;
}

$(document).ready(function() {
    initialize();
});