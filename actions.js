module.exports = function (self) {
	self.setActionDefinitions({

		// Action to start the countdown timer
		start_down: {
			name: 'Start Countdown',
			callback: async () => {
				if (!self.socket?.connected){
					return;
				}
				self.socket.emit('update state', 'CountDown')
				self.log('debug', '▶️ Sent Start CountDown')
			},
			},


			stop: {
			name: 'Stop Timer',
			callback: async () => {
				if (!self.socket?.connected){
					return;
				} 
				self.socket.emit('update state', 'Stop')
				self.log('debug', '▶️ Sent Stop')
			},
		},

		// Action to send a "show clock" command to the server
		show_clock: {
			name: 'Show Clock Time',
			callback: async () => {
				if (!self.socket?.connected){
					return;
				}
				self.socket.emit('update state', 'Clock')
				self.log('debug', '▶️ Sent Clock (show clock time)')
			},
		},

		// Action to start the counter counting up
		start_up: {
			name: 'Start Countup',
			callback: async () => {
				if (!self.socket?.connected){
					return;
				};
				self.socket.emit('update state', 'CountUp');
				self.log('debug', '▶️ Sent Start CountUp');
			},
		},

		// Action to set the countdown time in minutes and seconds
		setTime: {
			name: 'Set Countdown Time',
			options: [
				{
				id: 'minutes',
				type: 'number',
				label: 'Minutes',
				default: 10,
				min: 0,
				step: 1,
				},
				{
				id: 'seconds',
				type: 'number',
				label: 'Seconds',
				default: 0,
				min: 0,
				max: 59,
				step: 1,
				},
				{
				id: 'action',
				type: 'dropdown',
				label: 'On Set',
				default: 'stop',
				choices: [
					{ id: 'stop',label: 'Stop Countdown' },
					{ id: 'start',   label: 'Start Countdown' },
				],
				},
			],
		
			callback: async (action) => {
				if (!self.socket?.connected){
					return;
				}

				// pull from action.options, not self.actions
				const minutes = action.options.minutes || 0
				const seconds = action.options.seconds || 0
				const totalSeconds = ((minutes * 60) + seconds);

				if (action.options.action === 'stop') {
					self.socket.emit('update state', 'Stop')
					self.log('debug', '▶️ Sent Stop on Set')
				}

				self.socket.emit('set time', totalSeconds)

				if (action.options.action === 'start') {
					self.socket.emit('update state', 'CountDown')
				}

				self.log('debug',`▶️ Sent Set Time ${totalSeconds}s (${minutes}m ${seconds}s)`)
			},
		},

		// Action to set the colours for the countdown
		setColours: {
			name: 'Set Countdown Colours',
			options: [
				{
				id: 'red',
				type: 'number',
				label: 'Red background (mins)',
				default: 1,
				step: 1,
				},
				{
				id: 'orange',
				type: 'number',
				label: 'Orange (mins)',
				default: 5,
				step: 1,
				},
				{
				id: 'yellow',
				type: 'number',
				label: 'Yellow (mins)',
				default: 10,
				step: 1,
				},
				
			],
			
			callback: async (action) => {
				if (!self.socket?.connected){
					return;
				}

				if (action.options.controls == 'false'){
					let myControls = false;
				} else {
					let myControls = true;
				}

				self.socket.emit('set options', {"yellowAt":action.options.yellow, "redAt":action.options.orange, "flashAt":action.options.red});
				self.log('debug', `▶️ Sent Colours: {"yellowAt":${action.options.yellow}, "redAt":${action.options.orange}, "flashAt":${action.options.red}}`);
			},
		},

		// Action to count down to a specific time of day
		countUntilTime: {
		name: 'Countdown to Time Of Day',
		options: [
			{
				id: 'timeOfDay',
				type: 'textinput',
				label: 'Time of Day (HH:MM:SS)',
				default: '12:00:00',
				regex: '^([01]\\d|2[0-3]):([0-5]\\d):([0-5]\\d)$',
				/* 
					Regex:
					([01]\d|2[0-3])  → hours 00–23
					:([0-5]\d)       → minutes 00–59
					:([0-5]\d)       → seconds 00–59
				*/
				}
			
		],
			callback: async (action) => {
				if (!self.socket?.connected){
					return;
				}

				const timestring = action.options.timeOfDay;
				// convert timsestring to date object
				const now = new Date();
				const [hours, minutes, seconds] = timestring.split(':').map(Number);
				const targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds);
				// If target time is in the past, add a day
				if (targetTime < now) {
					targetTime.setDate(targetTime.getDate() + 1);
				}
				// Calculate the difference in milliseconds
				const timeDifference = targetTime - now;

				// Convert to seconds
				const totalSeconds = Math.floor(timeDifference / 1000);
			
				self.socket.emit('set time', totalSeconds)
				self.socket.emit('update state', 'CountDown')
				self.log('debug', `▶️ Sent Set Time to Countdown to ${timestring}`);
			},
		},

		// Action to turn on or off the slide controls
		slideControls: {
			name: 'Slide Controls',
			options: [
			{
				id: 'showControls',
				type: 'dropdown',
				label: 'Show Slide Controls',
				default: 'false',
				choices: [
					{ id: 'false',label: 'false' },
					{ id: 'true',   label: 'true' },
				],
				},  
			],

			callback: async (action) => {
			let myControls = true;
				if (!self.socket?.connected){
					return;
				}
			
				if (action.options.showControls == 'false'){
					myControls = false;
				}

				self.socket.emit('set options', {'yellowAt': self.getVariableValue('yellowTime'), "redAt": self.getVariableValue('orangeTime'), "flashAt": self.getVariableValue('redTime'), 'slideControls': myControls});
				self.log('debug', `▶️ Sent set options: {slideControls:${myControls}}`);
			},
		},

		// Action to send a "next slide" command
		next_slide: {
			name: 'Next Slide',
			callback: async () => {
				if (!self.socket?.connected){
					return;
				}
				const newSlideNumber = parseInt(self.getVariableValue('slideNumber')) + 1;
				self.socket.emit('next back', {"next":true,"back":false, "slideNumber": newSlideNumber});

				setTimeout(() => {
					self.socket.emit('next back', {"next":false,"back":false, "slideNumber": newSlideNumber});
				}, 200); 

				self.log('debug', `▶️ Sent Next Slide command (slide now ${newSlideNumber})`)
				// update slideNumber variable
				self.setVariableValues({
					slideNumber: newSlideNumber,
				});
			},
		},
		// Action to send a "previous slide" command
		previous_slide: {
			name: 'Previous Slide',
			callback: async () => {
				if (!self.socket?.connected){
					return;
				}
				let newSlideNumber = parseInt(self.getVariableValue('slideNumber')) - 1 || 1;
				if (newSlideNumber < 1) {
					newSlideNumber = 1; // Prevent going to slide number less than 1
				}
				self.socket.emit('next back', {"next":false,"back":true, "slideNumber":newSlideNumber});

				setTimeout(() => {
					self.socket.emit('next back', {"next":false,"back":false, "slideNumber": newSlideNumber});
				}, 200); 
				
				self.log('debug', `▶️ Sent Previous Slide command (slide now ${newSlideNumber})`)
				// update slideNumber variable
				self.setVariableValues({
					slideNumber: newSlideNumber,
				});
			},
		},
	})
  }



