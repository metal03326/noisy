/**
 * Noisy Preferences module for data binding between the DOM and the preferences object
 *
 * @author metal03326
 * @version 20141127
 */

// Preferences singleton to be passed to Noisy
var pref =
{
	// Flag showing if we are running Noisy for the first time
	firstTime: true,

	// Load method will save the original settings here, to be used later if user wants to reset to defaults
	originalSettings: null,

	// Default settings
	settings: {
		"values": {
			"power-saver-state": "15",
			"preference-user-language": "en",
			"preference-theme": "default",
			"preference-scrobbling-position": "50",
			"preference-notification-popup-format": "%artist% - %title%",
			"preference-status-bar-format": "%artist% - %title%",
			"preference-window-title-format": "%artist% - %title%",
			"preference-playlist-format": "%artist% - %title%"
		},
		"checkboxes": {
			"preference-enable-notifications": false,
			"preference-enable-counter": true,
			"preference-enable-animations": true,
			"preference-enable-powersaver": true,
			"preference-enable-scrobbling": true,
			"preference-hide-playlist-tabs": false,
			"preference-playback-follows-cursor": false,
			"preference-cursor-follows-playback": false
		},
		"showWelcome": true, "keys": [
			{"key": "17+81", "action": "addToQueue"},
			{"key": "81", "action": "addToQueue"},
			{"key": "74", "action": "showSearch"},
			{"key": "66", "action": "next"},
			{"key": "86", "action": "stop"},
			{"key": "67", "action": "playPause"},
			{"key": "88", "action": "play"},
			{"key": "90", "action": "prev"},
			{"key": "17+38", "action": "volumeUp"},
			{"key": "17+40", "action": "volumeDown"},
			{"key": "77", "action": "toggleMute"},
			{"key": "46", "action": "removeFromPlaylist"}
		],
		"volume": 1,
		"activePlaylistId": null,
		"muted": false,
		"playbackOrder": 0,
		"devChannel": false,
		"dropbox": {
			"accessToken": null
		},
		"googledrive": {
			"accessToken": null
		},
		"lastfm": {
			"accessToken": null
		}
	},

	save: function()
	{
		localStorage.setItem( 'preferences', JSON.stringify( this.settings ) );
	},

	load: function()
	{
		this.originalSettings = JSON.parse( JSON.stringify( this.settings ) );
		var settings = localStorage.getItem( 'preferences' );
		if( settings )
		{
			this.settings = JSON.parse( settings );
			this.firstTime = false;
		}
	},

	'import': function( settings )
	{
		this.settings = settings;
		this.save();
	},

	'export': function()
	{
		return this.settings;
	},

	process: function()
	{
		// Set language if we are running for the first time
		if( this.firstTime )
		{
			// Take default user language and set it as language
			var language = navigator.language.split( '-' ).shift();

			// Set language to English if we don't have translations for this language
			if( !lang[ language ] )
			{
				language = 'en';
			}

			document.getElementById( 'preference-user-language' ).value = language;

			// Save preferences for the first time
			this.lang = language;
		}

		// Load all elements that have it's values stored in .value property
		var inputs = this.settings.values,
			inputEl;
		for( var input in inputs )
		{
			inputEl = document.getElementById( input );
			if( inputEl )
			{
				inputEl.value = this.settings.values[ input ];
			}
			else
			{
				n.warn( 'missing-element', input );
			}
		}

		// Load all elements that havev it's values stored in .checked property
		var checkboxes = this.settings.checkboxes,
			checkboxEl;
		for( var checkbox in checkboxes )
		{
			checkboxEl = document.getElementById( checkbox );
			if( checkboxEl )
			{
				checkboxEl.checked = this.settings.checkboxes[ checkbox ];
			}
			else
			{
				n.warn( 'missing-element', checkbox );
			}
		}

		// Render loaded keyboard shortcuts into the table in preferences window
		n.renderKeyboardShortcuts();

		// Set volume to loaded value or to maximum if no saved value found
		n.audio.volume = this.settings.volume;

		// Set mute state depending on loaded value
		n.audio.muted = this.settings.muted;

		n.updateVolumeState();

		// Load playback order
		var playbackOrder = document.getElementById( 'playback-order' );
		if( playbackOrder )
		{
			playbackOrder.selectedIndex = this.settings.playbackOrder || 0;
			n.audio.loop = !( 2 - playbackOrder.selectedIndex );
		}
		else
		{
			n.warn( 'missing-element', 'playback-order' );
		}

		// Set welcome window state
		document.getElementById( 'show-on-startup-checkbox' ).checked = this.settings.showWelcome;

		// Set Dropbox access token to loaded value
		n.dropbox.accessToken = this.settings.dropbox.accessToken;

		// Set Google Drive access token to loaded value
		n.googledrive.accessToken = this.settings.googledrive.accessToken;

		// Set Last.fm access token to loaded value
		n.lastfm.accessToken = this.settings.lastfm.accessToken;
		n.lastfm.userName = this.settings.lastfm.userName;

		// Set language
		n.lang = lang[ this.lang ];

		// Disable counter update if user said so
		if( !this.counter )
		{
			document.getElementById( 'footer-counter' ).classList.add( 'hidden' );
		}

		// Un-check Power Saver checkbox if it's not supported by the browser
		var powerSaver = document.getElementById( 'preference-enable-powersaver' );
		if( powerSaver.checked && document.getElementById( 'preference-performance-powersaver' ).classList.contains( 'not-supported' ) )
		{
			powerSaver.checked = false;
			n.changePowerSaverState( false );
		}
	},

	set playbackOrder( value )
	{
		var shouldSave = this.settings.playbackOrder != value;
		this.settings.playbackOrder = value;
		if( shouldSave )
		{
			this.save();
		}
	},

	set key( object )
	{
		this.settings.keys.unshift( object );
		this.save();
	},

	get keys()
	{
		return this.settings.keys;
	},

	set deleteKey( idx )
	{
		this.settings.keys.splice( this.settings.keys.length - idx, 1 );
		this.save();
	},

	set input( input )
	{
		var shouldSave;
		if( 'checkbox' == input.type )
		{
			shouldSave = this.settings.checkboxes[ input.id ] != input.checked;
			this.settings.checkboxes[ input.id ] = input.checked;
		}
		else
		{
			shouldSave = this.settings.values[ input.id ] != input.value;
			this.settings.values[ input.id ] = input.value;
		}
		if( shouldSave )
		{
			this.save();
		}
	},

	set showWelcome( value )
	{
		var shouldSave = this.settings.showWelcome != value;
		this.settings.showWelcome = value;
		if( shouldSave )
		{
			this.save();
		}
	},

	get showWelcome()
	{
		return this.settings.showWelcome;
	},

	set lang( value )
	{
		var shouldSave = n.lang != lang[ value ];
		n.lang = lang[ value ];
		this.settings.values[ 'preference-user-language' ] = value;
		if( shouldSave )
		{
			this.save();
		}
	},

	get lang()
	{
		return this.settings.values[ 'preference-user-language' ];
	},

	set theme( value )
	{
		var shouldSave = this.settings.values[ 'preference-theme' ] != value;
		this.settings.values[ 'preference-theme' ] = value;
		if( shouldSave )
		{
			this.save();
		}
	},

	set powerSaverState( value )
	{
		var shouldSave = this.settings.values[ 'power-saver-state' ] != value;
		this.settings.values[ 'power-saver-state' ] = value;
		if( shouldSave )
		{
			this.save();
		}
	},

	set accessToken( object )
	{
		var shouldSave = this.settings[ object.cloud ].accessToken != object.accessToken;
		this.settings[ object.cloud ].accessToken = object.accessToken;
		if( shouldSave )
		{
			this.save();
		}
	},

	set activePlaylistId( value )
	{
		this.settings.activePlaylistId = value;
		if( value )
		{
			this.scrollTop = document.getElementById( value ).scrollTop;
		}
		else
		{
			delete this.settings.scrollTop;
			this.save();
		}
	},

	get activePlaylistId()
	{
		return this.settings.activePlaylistId;
	},

	set scrollTop( value )
	{
		var shouldSave = this.settings.scrollTop != value;
		this.settings.scrollTop = value;
		if( shouldSave )
		{
			this.save();
		}
	},

	get scrollTop()
	{
		return this.settings.scrollTop;
	},

	set tokenCloud( value )
	{
		var shouldSave = this.settings.tokenCloud != value;
		this.settings.tokenCloud = value;
		if( shouldSave )
		{
			this.save();
		}
	},

	get tokenCloud()
	{
		return this.settings.tokenCloud;
	},

	set userName( object )
	{
		var shouldSave = this.settings[ object.cloud ].userName != object.userName;
		this.settings[ object.cloud ].userName = object.userName;
		if( shouldSave )
		{
			this.save();
		}
	},

	set muted( value )
	{
		var shouldSave = this.settings.muted != value;
		this.settings.muted = value;
		n.audio.muted = value;
		n.updateVolumeState();
		if( shouldSave )
		{
			this.save();
		}
	},

	set volume( value )
	{
		// Fix 0.7000000000000001 to be 0.7
		value = parseFloat( value.toFixed( 1 ) );
		var shouldSave = this.settings.volume != value;
		this.settings.volume = value;
		n.audio.muted = this.settings.muted = false;
		n.audio.volume = value;
		n.updateVolumeState();
		if( shouldSave )
		{
			this.save();
		}
	},

	get scrobbling()
	{
		return this.settings.checkboxes[ 'preference-enable-scrobbling' ];
	},

	get counter()
	{
		return this.settings.checkboxes[ 'preference-enable-counter' ];
	},

	get notify()
	{
		return this.settings.checkboxes[ 'preference-enable-notifications' ];
	},

	get powerSaverEnabled()
	{
		return this.settings.checkboxes[ "preference-enable-powersaver" ];
	},

	set devChannel( state )
	{
		this.settings.devChannel = state;
		this.save();
	},

	get devChannel()
	{
		return this.settings.devChannel;
	}
};

// Load the preferences from localStorage
pref.load();