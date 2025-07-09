const { InstanceBase, runEntrypoint, InstanceStatus } = require('@companion-module/base');
const io = require('socket.io-client');

const UpdateActions             = require('./actions');
const UpdateVariableDefinitions = require('./variables');
const UpdateFeedbacks           = require('./feedbacks');


class SpeakerTimerInstance extends InstanceBase {
	constructor(internal) {
		super(internal);
		this.socket       = null;
		this.counterId    = null;
		this.syncInterval = null;
		this.timeTick     = null; 
	}

	/** Web UI config */
	getConfigFields() {
		return [
			{
				type:    'textinput',
				id:      'license',
				label:   'Custom license (optional)',
				width:   12,
				default: '',
			},
			{
				type:    'textinput',
				id:      'timer',
				label:   'Timer ID',
				width:   4,
				default: '101',
			},
		];
	}

	updateActions() {
		UpdateActions(this);
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this);
	}

	updateFeedbacks() {
		UpdateFeedbacks(this);
	}

	async init(config) {
		this.config = config;
		this.updateVariableDefinitions(); // export variable definitions
		this.updateActions(); // export action definitions
		this.updateFeedbacks(); // export feedbacks

		this.setVariableValues({
			yellowTime: 10,          // default thresholds
			orangeTime: 5 ,
			redTime: 1,
			slideNumber: 0,
		})

		// Build counterId and raw license
		const licenseRaw = this.config.license?.trim() || 'attend2it';
		const license    = licenseRaw.replace(/\W+/g, '') || 'attend2it';
		const pageId     = String(this.config.timer || '');
		this.counterId   = `${license}${pageId}`;

		this.log('debug', `Constructed counterId: ${this.counterId}`);

		// Initialize Socket.IO
		const PA    = 'https://api.speakertimer.co.uk:8083';
		this.socket = io(PA, { autoConnect: false });

		// Error logging
		this.socket.on('connect_error', (err) => this.log('error', 'Socket.IO connect_error: ' + err.message));
		this.socket.on('error', (err) => this.log('error', 'Socket.IO error: ' + err));

		// Log incoming
		this.socket.onAny((event, ...args) => {
			this.log('debug', `Socket received -> ${event}`, JSON.stringify(args));
		});

		// Wrap outbound
		const origEmit = this.socket.emit.bind(this.socket);
		this.socket.emit = (event, ...args) => {
			this.log('debug', `Socket emit -> ${event}`, JSON.stringify(args));
			return origEmit(event, ...args);
		};

		// On connect
		this.socket.on('connect', () => {
			this.log('info', 'Socket.IO connected, sid=' + this.socket.id);
			this.updateStatus(InstanceStatus.Ok, 'Connected');
		});

		// On disconnect, clear sync interval
		this.socket.on('disconnect', (reason) => {
			this.log('warn', 'Socket.IO disconnected: ' + reason);
			this.updateStatus(InstanceStatus.Warn, 'Lost connection');
			if (this.syncInterval) {
				clearInterval(this.syncInterval);
				this.syncInterval = null;
			}

			// clear timeTick interval
			if (this.timeTick) {
				clearInterval(timeTick);
				this.timeTick = null;
			}
		});

		// Server requests identity
		this.socket.on('request uid', () => {
			this.log('info', 'Received request uid, sending identification');
			this.socket.emit('send id', this.counterId, licenseRaw);
			this.socket.emit('i am timer');
			// Perform initial sync and then start periodic sync every second
			this.socket.emit('sync me');
			
			if (!this.syncInterval) {
				this.syncInterval = setInterval(() => {
					this.socket.emit('sync me');
				}, 10000);
			}

			// every second, update the time variables
			if (!this.timeTick) {
				this.timeTick = setInterval(() => {
					// get the timerstate variable
					const timerState = this.getVariableValue('timerstate');
					// if the timerstate is 'CountDown' subtract 1000 from the timeremaining variable
					if (timerState == 'CountDown') {
						const timeRemaining = this.getVariableValue('timeremaining');
						const newTimeRemaining  = timeRemaining - 1000;
						//update the variables
						this.setVariableValues({
							timeremaining: newTimeRemaining,
							timestring: msToMmSs(newTimeRemaining),
						});
					} else if (timerState == 'CountUp') {
						const timeRemaining = this.getVariableValue('timeremaining');
						const newTimeRemaining  = timeRemaining + 1000;
						//update the variables
						this.setVariableValues({
							timeremaining: newTimeRemaining,
							timestring: msToMmSs(newTimeRemaining),
						});
						
					}
					this.checkFeedbacks('countdownColours');
				}, 1000);
			}
		});

		// Handle options change messages 
		this.socket.on('options', (opts) => {
		
			let myControls;
			if (opts){
				if (opts.slideControls !== undefined) {
					myControls = opts.slideControls;
				} else {
					myControls = true;
				}
				// update variables
				this.setVariableValues({
					yellowTime: opts.yellowAt,
					orangeTime: opts.redAt,
					redTime: opts.flashAt,
					controls: myControls
				});
				// Update feedbacks if needed
				this.updateFeedbacks();
			}
		});

		// handle sync messages
		this.socket.on('sync', (data, state, id) => {
			if (typeof data === 'object' && state === undefined) {
				({ data, state, id } = data);
			}

			// Update variables based on state
			this.setVariableValues({
				timerstate: JSON.stringify(state).replace(/^"|"$/g, ''),
				timeremaining: data,
				timestring: msToMmSs(data),
			})
			this.updateFeedbacks();
		});
		
		// handle messages sent slide changes
		this.socket.on('next back', ({ next, back, slideNumber }) => {
			this.log('debug', `Slides: ${next}, back: ${back}, slideNumber: ${slideNumber}`);

			// update slide number
			if (this.getVariableValue('slideNumber') !== slideNumber) {
				this.setVariableValues({
					slideNumber: slideNumber,
				});
			}
		});
		
		// Connect
		this.socket.connect();
	}

	async configUpdated(config) {
		await this.destroy();
		await this.init(config);
	}

	async destroy() {
		if (this.syncInterval) {
			clearInterval(this.syncInterval);
			this.syncInterval = null;
		}
	
		if (this.timeTick) {
			clearInterval(this.timeTick);
			this.timeTick = null;
		}
	
		if (this.socket) {
			this.socket.disconnect();
			this.socket.removeAllListeners();
			this.socket = null;
		}
	}
}

// Companion module entrypoint
runEntrypoint(SpeakerTimerInstance, []);

function msToMmSs(ms) {
	// Remember if it's negative
	const sign = ms < 0 ? '-' : '';

	// Work with the absolute value for splitting into mm:ss
	const totalSeconds = Math.floor(Math.abs(ms) / 1000);
	const minutes      = Math.floor(totalSeconds / 60);
	const seconds      = totalSeconds % 60;

	// Zero-pad each field
	const mm = String(minutes).padStart(2, '0');
	const ss = String(seconds).padStart(2, '0');

	// Prepend sign
	return `${sign}${mm}:${ss}`;
}