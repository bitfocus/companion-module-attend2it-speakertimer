const { combineRgb } = require('@companion-module/base')

module.exports = async function (self) {
	self.setFeedbackDefinitions({
		countdownColours: {
			type: 'advanced',
			name: 'Countdown Colours',
			label: 'Countdown Colours',
			description: 'Change button colours based on how much time is left',
			defaultStyle: {
				bgcolor: combineRgb(0, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [], // no user options required

			callback: () => {
				// get values from variables
				const remMs = parseInt(self.getVariableValue('timeremaining')) || 0;
				const redMs    = parseFloat(self.getVariableValue('redTime')) * 60_000;
				const orangeMs = parseFloat(self.getVariableValue('orangeTime')) * 60_000;
				const yellowMs = parseFloat(self.getVariableValue('yellowTime')) * 60_000;

				// prepare style object
				let style = {
					bgcolor: combineRgb(0, 0, 0),   // default black background
					color:  combineRgb(0, 255, 0),  // default green text
				}
		
				if (remMs < redMs) {
					// below red threshold → red background, black text
					style.bgcolor = combineRgb(255, 0, 0)
					style.color   = combineRgb(0, 0, 0)
				} else if (remMs < orangeMs) {
					// between red and orange → black background, orange text
					style.bgcolor = combineRgb(0, 0, 0)
					style.color   = combineRgb(255, 165, 0)
				} else if (remMs < yellowMs) {
					// between orange and yellow → black background, orange text
					style.bgcolor = combineRgb(0, 0, 0)
					style.color   = combineRgb(255, 255, 0)
				} else {
					// if no colour thresholds are met →  black background, green text
					style.bgcolor = combineRgb(0, 0, 0)
					style.color   = combineRgb(0, 255, 0)
				}
				
				return style
			},
		},
	})
}
