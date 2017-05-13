/**
 * Noisy - Your cloud player
 *
 * @author metal03326
 * @version n.version
 */

'use strict';
/* HIGH PRIORITY */
//TODO: Check Teddy for a problem with now playing of Five Finger Death Punch - Wrong Side of Heaven. It says invalid
// signiture supplied TODO: Implement Drag and Drop Directories under Chrome

/* NORMAL PRIORITY */
//TODO: Make a page with things to be dropped and when (approximately)
//TODO: Fix double tag read under Firefox
//TODO: Go around the code and find usages for n.log/warn/error.
//TODO: Finish the animated video for the welcome screen.
//TODO: Implement WAI-ARIA.
//TODO: Add WebVTT - Web Video Text Tracks to the intro video
//TODO: Introduce n.pref.batch() to make changes to n.pref.settings object at once before saving. This should save a
// few CPU cycles when two or more things needs to be saved; TODO: Add localStorage compression alogorithm (disabled by
// default, since we save playlists too often)

/* LOW PRIORITY */
//TODO: Finish tests.

/* After everything else */
//TODO: Add easter egg somewhere on the about page.

// Noisy singleton
let n = {
	// Pointer to the active audio element

	// HTML Audio element which will play files
	audio: document.createElement( 'audio' ),

	// Battery level watcher
	battery: null,

	// Flag rised when adding files/folders to the playlist should be halted
	cancelAction: false,

	// Referance to the console window
	console: document.getElementById( 'console-content' ),

	// Dropbox communication goes through here. See dropbox.js file for more info.
	dropbox: dropbox,

	// Detected formats that the browser is able to play in Audio tag
	formats: [],

	// Google Drive communication goes through here. See googledrive.js file for more info.
	googledrive: googledrive,

	// Default language is English
	lang: lang.en,

	// Last.fm communication goes through here. See lastfm.js file for more info.
	lastfm: lastfm,

	// Save last search term, as we need to check for it next time the user presses Enter and initiate play instead of
	// search if terms match
	lastSearchTerm: '',

	// Stores last date in which we checked for updates, because we need to check once per day
	lastUpdateCheck: null,

	// Fake cloud object for local playback
	local: {
		// Object containing all files from user's choise. Format is playlistId: file
		files: {},

		urlManager: urlManager,

		/**
		 * Show local window instead of actually trying to connect to a cloud
		 */
		getFolderContents()
		{
			n.window( 'local-window' );
			document.getElementById( 'loading-folder-contents' ).classList.add( 'visibility-hidden' );
		},

		// Local playback is always authenticated, as long as the user has added files
		isAuthenticated: true,

		/**
		 * Playing a local file shouldn't send a request
		 * @param {HTMLElement} item Required. Item chosen by the user or Noisy for playback
		 */
		play( item )
		{
			// Try loading the file from the cache
			let url = this.urlManager.get( item.dataset.url );

			// Create ObjectUrl if load failed
			if ( !url )
			{
				// Create ObjectURL from the item
				url = URL.createObjectURL( n.local.files[ item.parentNode.id ][ parseInt( item.dataset.url, 10 ) ] );
				this.urlManager.add( item.dataset.url, url );
			}

			n.lastfm.scrobble();

			n.log( 'playbackWait', item.dataset.placeholder );

			n.setTitle( item );
			n.setFooter( item );

			let items = item.parentNode.querySelectorAll( '.playlist-item' );

			// Get the index of the focused item and tell the audio element which item is being played, so we can later
			// get it
			n.audio.dataset.item     = Array.prototype.indexOf.call( items, item );
			n.audio.dataset.playlist = item.parentNode.id;

			n.audio.src = url;
			n.audio.load();

			// Each time user plays something, we check for updates
			let now = Math.floor( +new Date() / 86400000 );

			if ( now > n.lastUpdateCheck )
			{
				applicationCache.update();
				n.lastUpdateCheck = now;
			}
		},

		/**
		 * Empty function only to avoid errors
		 */
		preload(){
		}
	},

	// Indicates if in moving mode
	moving: false,

	// Playlist Item being moved
	movingItem: null,

	// Playlist tab being moved
	movingTab: null,

	// Progressbar being changed
	movingBar: null,

	// Height of the grabbed playlist item. All items should be with the same size
	//TODO: Items with very long names may brake into a couple of lines, which will braak this. Fix that all lines are
	//actually on one line and use elipsis for long lines
	movingItemHeight: -1,

	// Was anything changed? Save?
	movingShouldSave: false,

	// Starting position for the drag. Will be overwritten each time an playlist item is moved
	movingStartY: -1,

	// Starting position for the drag. Will be overwritten each time a playlist tab is moved
	movingStartX: -1,

	// Shows if Noisy is in power saving mode (meaning the device is not charging and battery level is below the
	// threshold set) or not
	powerSaveMode: false,

	// Preferences object - all preferences are available here
	pref: pref,

	// True when pre-load was initiated
	preloaded: false,

	// Playback queue
	queue: [],

	// JavaScript FileReader which will read file matadata
	reader: null,

	// TImeout when delaying the save of preferences
	saveTimeout: null,

	// Properties that shows if Noisy should refresh a part of itself
	//TODO: Make this an object like refresh:{playlist:0,statusbar:1,title:1}
	shouldRefreshPlaylist   : false,
	shouldRefreshStatusBar  : false,
	shouldRefreshWindowTitle: false,

	// Interval for the slideshow at the welcome screen
	slideshow: null,

	// Object containing all the themes available
	themes: themes,

	// Version of Noisy
	version: 20170506,

	/**
	 * Deselect all selected items from the current playlist and find window
	 * @private
	 */
	_deselectItems()
	{
		// Find the selected items
		let selected           = document.querySelectorAll( '#'.concat( n.activePlaylistId, ' .selected,.window .selected' ) );
		let selectedString     = 'selected';
		let confirmationString = 'confirmation';

		// Deselect them
		for ( let i = selected.length; i--; )
		{
			selected[ i ].classList.remove( selectedString );

			// User might have pressed Delete button, thus marking the selected items for removal and them wanting to
			// stop it by deselection
			selected[ i ].classList.remove( confirmationString );
		}
	},

	/**
	 * Fills a table row for a shortuct. Not local because it's used both for initial creation and for when the user
	 * creates a new one from Preferences
	 * @param {HTMLElement} tr Required. Row to which the information will be inserted
	 * @param {String} dataKey Required. Key combination in it's numering format (17+40)
	 * @param {String} dataAction Required. Action in it's value format (volumeDown)
	 * @param {String} keys Required. Key combination in it's human readable format (Ctrl + Down)
	 * @param {String} action Required. Action in it's human readable format (Volume down)
	 * @private
	 */
	_prepareShortcutRow( tr, dataKey, dataAction, keys, action )
	{
		tr.dataset.keys   = dataKey;
		tr.dataset.action = dataAction;
		tr.classList.add( 'va' );
		tr.innerHTML = '<td>'.concat( keys, '</td><td class="', dataAction, '">', action, '</td><td><button onclick="n.onDeleteKeyboardShortcut(this)">&times;</button></td>' );
	},

	/**
	 * Select items depending on the keys pressed. Here is the whole logic for multiple selection. Not local because
	 * it's used for both playlist and cloud items
	 * @param {Event} e Required. Mouse event happened
	 * @param {String} containerId Required. Container in which to search for items
	 * @param {String} itemClass Required. Class name of the items available for selection
	 * @param {String} selectedClass Required. Class name to be applied to the selected items
	 * @private
	 */
	_selectItems( e, containerId, itemClass, selectedClass )
	{
		let selectionStart = document.getElementById( 'selection-start' );

		if ( e.shiftKey )
		{
			if ( selectionStart )
			{
				// Get all items in the active playlist
				let items         = document.getElementById( containerId ).querySelectorAll( itemClass );
				// Get the index of the focused item
				let idx           = Array.prototype.indexOf.call( items, selectionStart );
				// Get the index of the clicked item
				let idx2          = Array.prototype.indexOf.call( items, this );
				let selectedItems = document.getElementById( containerId ).querySelectorAll( '.selected' );

				// First de-select all items
				for ( let i = selectedItems.length; i--; )
				{
					selectedItems[ i ].classList.remove( 'selected' );
				}

				// Search for the selected and focused items inside of the find window if not found in the playlist
				if ( !~idx || !~idx2 )
				{
					let window = document.getElementById( 'find-window-results' );

					if ( window )
					{
						items = window.querySelectorAll( itemClass );
						// Get the index of the focused item
						idx   = Array.prototype.indexOf.call( items, selectionStart );
						// Get the index of the clicked item
						idx2  = Array.prototype.indexOf.call( items, this );
					}
				}

				// Continue only if both selected and focused items found
				if ( ~idx && ~idx2 )
				{
					// Get the lower index of both items
					let min = Math.min( idx, idx2 );
					// Get the higher index of both items
					let max = Math.max( idx, idx2 );

					// Iterate items between focused and clicked and toggle selected state
					for ( let i = min; i <= max; i++ )
					{
						let item = items[ i ];
						item.classList.add( selectedClass );
					}

					// Fix focused item, as it's selected class will always be removed
					items[ idx <= idx2 ? min : max ].classList.add( selectedClass );
				}
				// Otherwise user has clicked for the first time and we need to add class only to clicked element
				else
				{
					this.classList.add( selectedClass );
					this.id = 'selection-start';
				}
			}
		}
		else
		{
			if ( selectionStart )
			{
				selectionStart.removeAttribute( 'id' );
			}
			this.id = 'selection-start';

			if ( e.ctrlKey )
			{
				this.classList.toggle( selectedClass );
			}
			else
			{
				this.classList.add( selectedClass );
			}
		}
	},

	/**
	 * Returns item being played/paused/loaded
	 * @returns {HTMLElement}
	 */
	get activeItem()
	{
		let item = document.getElementById( 'playlists' ).querySelector( 'div[data-icon="c"]' ) ||
			document.getElementById( 'playlists' ).querySelector( 'div[data-icon="x"]' ) ||
			document.getElementById( 'playlists' ).querySelector( 'div[data-icon="w"]' );

		if ( item )
		{
			item = item.parentNode.parentNode;
		}

		return item;
	},

	/**
	 * Get the id of the currently visible to the user playlist.
	 *
	 * @return {String} Id
	 */
	get activePlaylistId()
	{
		let tab = document.getElementById( 'playlists-tabs' ).querySelector( '.active' );
		return tab ? tab.dataset.for : null;
	},

	/**
	 * Adds a file to a playlist
	 * @param {HTMLElement} file Required. Item from which to read all the cloud date
	 * @param {String} playlistId Required. Id of the playlist to which to add the new item
	 */
	addFile( file, playlistId )
	{
		n.fillPlaylist( playlistId, [
			{ url: file.dataset.path, cloud: file.dataset.cloud, placeholder: file.dataset.name }
		] );
	},

	/**
	 * Handler for Add button in cloud window. Adds selected files or folders to the active playlist
	 */
	addFileFolder()
	{
		// Get selected items
		let items      = document.getElementById( 'add-window-files' ).querySelectorAll( '.active' );
		let playlistId = n.activePlaylistId;

		// Make sure we are starting to add files without raised stop flag
		n.cancelAction = false;

		// Show stop icon in the footer
		document.getElementById( 'footer' ).classList.add( 'cancel-action' );

		// Create a new playlist, if the user hasn't created/selected any
		if ( !playlistId )
		{
			n.newPlaylist();
			playlistId = n.activePlaylistId;
		}

		// Loop all selected items in asyncronius loop because of all AJAX requests
		asyncLoop( items.length - 1, loop =>
		{
			// Stop if the stop flag is up
			if ( n.cancelAction )
			{
				n.cancelAction = false;
				loop.break();
			}
			else
			{
				// Get current selected item
				let selected = items[ loop.index ];

				// Process as folder if one
				if ( selected.dataset.folder === 'true' )
				{
					// Setup counter of how many files are added. As this is an object, passing it as a param will
					// actually pass a reference, meaning all modifications to it will be available in the callback
					// closure
					let count = {
						added: 0
					};

					// Start the recursive looping through the folder tree and call the callback when the tree has been
					// walked
					n.addFolder( selected.dataset.path, selected.dataset.cloud, count, playlistId, () =>
					{
						// Print success message in the status bar containing number of items added
						n.setFooter( '<span id="footer-finished">'.concat( n.lang.footer[ 'footer-finished' ], count.added, '</span>' ) );

						// Save playlist as new items are added
						n.savePlaylist( document.getElementById( n.activePlaylistId ) );

						// Continue to next item in the selection
						loop.next();
					} );
				}
				// Otherwise just add the selected file and move on
				else
				{
					n.addFile( selected, playlistId );
					loop.next();
				}
			}
		}, () =>
		{
			// After everything is finished save the playlist
			n.savePlaylist( document.getElementById( n.activePlaylistId ) );

			// Take the stopping flag down
			n.cancelAction = false;

			// And finally remove the stop icon
			document.getElementById( 'footer' ).classList.remove( 'cancel-action' );
		} );

		// Close the window (user can monitor the process in the status bar)
		n.closeAll();
	},

	/**
	 * Recursive function for adding files from folder and subfolders
	 * @param {String} folder Required. Folder path/id being scanned
	 * @param {String} cloud Required. Cloud name from which we currently read items
	 * @param {Object} count Required. Object instance created at the beginning of the file/folder add process
	 * @param {String} playlistId Required. The id of the playlist to which the files should be added
	 * @param {Function} [callback] Optional. Function to call after all items in this folder were processed
	 */
	//TODO: Check if cloud is Google Drive and print different message to the status bar, as the id of the folder
	// doesn't bring any valuable information to him
	//TODO: Maybe make the count object not required
	addFolder( folder, cloud, count, playlistId, callback = new Function() )
	{
		// Show the new folder to the user
		n.setFooter( '<span id="footer-progress">'.concat( n.lang.footer[ 'adding-files-from' ], folder, n.lang.footer[ 'added-items' ], count.added, '</span>' ) );

		// Request folder contents
		n[ cloud ].getFolderContents( folder, ( files, folders ) =>
		{
			let toAdd = [];

			// Increase counter with the count of the returned files
			count.added += files.length;

			// Add all files to the playlist
			files.forEach( file =>
			{
				toAdd.push( { url: file.path, placeholder: file.name, cloud: file.cloud } );
			} );

			n.fillPlaylist( playlistId, toAdd );

			// Repeat if we have folders
			if ( folders.length )
			{
				// Asyncronius loop as we are waiting for server response
				asyncLoop( folders.length - 1, loop =>
				{
					// Stop if flag raised
					if ( n.cancelAction )
					{
						loop.break();
					}
					// Otherwise call ourselfs again
					else
					{
						n.addFolder( folders[ loop.index ].path, cloud, count, playlistId, loop.next );
					}
				}, callback );
			}
			// Call the callback in the end
			else
			{
				callback();
			}
		} );
	},

	/**
	 * Adds item to cloud window. It's either a file item or folder item
	 * @param {Object} item Required. Object containing item name, type and from what cloud it's comming
	 * @returns {HTMLElement}
	 */
	addItemToWindow( item )
	{
		// Create the section element which will be apended to the cloud window
		let sec = document.createElement( 'section' );

		sec.className = 'add-item';
		sec.setAttribute( 'tabindex', 0 );

		// Make all key:value pairs of the passed item to be added to the section element as data-key="value"
		Object.assign( sec.dataset, item );

		// Add the visual to the user part (icon depending of the type and name)
		sec.innerHTML = '<span data-icon=\''.concat( ( item.folder ? 'f' : '"' ), '\'></span>', item.name );

		// Attach events to the newly created item
		sec.addEventListener( 'mousedown', n.onAddItemDown );
		sec.addEventListener( 'dblclick', n.onAddItemDblClick );

		// And append it
		document.getElementById( 'add-window-files' ).appendChild( sec );

		return sec;
	},

	/**
	 * Adds item to playback's queue.
	 * @param {HTMLElement} [item] Optional. Item to add to the queue. If not supplied, the selected one on the active
	 * playlist will be added.
	 */
	addToQueue( item )
	{
		// Select item to the queue
		item = item && item.tagName ? item : n.currentlySelectedItem;

		/**
		 * The real add to queue happens here. Because user may want to add more than one item, we need an external
		 * function for the adding part, so we can call it from different places
		 * @param {HTMLElement} item Required. Playlist item which we have to add to the queue
		 * @private
		 */
		function _add( item )
		{
			// Add item to the queue
			n.queue.push( item );

			// Mark item as in queue
			item.classList.add( 'is-in-queue' );

			// Set item queue state
			let queueState = item.querySelector( '.item-queue' );

			if ( !queueState.innerHTML )
			{
				queueState.innerHTML = n.queue.length;
			}
		}

		// Get all selected items
		let items = document.getElementById( n.activePlaylistId ).querySelectorAll( '.selected' );

		// Add them all if many
		if ( ~Array.prototype.indexOf.call( items, item ) )
		{
			for ( let i = 0; i < items.length; i++ )
			{
				_add( items[ i ] );
			}
		}
		// Or add only one if single
		else
		{
			_add( item );
		}
	},

	/**
	 * Enables or disables features, depending on the state of power save mode
	 */
	applyPowerSaveMode()
	{
		n.initAnimations();
		n.changeCounterState( document.getElementById( 'preference-enable-counter' ).checked );
	},

	/**
	 * Constructs style tag for chosen theme and appends it to the DOM.
	 */
	applyTheme()
	{
		// Get selected theme
		let theme           = document.getElementById( 'preference-theme' ).value;
		// Style tag string to be appended in the end
		let styles          = '';
		// CSS selector being read from themes object
		let selector;
		// CSS rule (eg display: block) to be concatenated in the style string
		let rule;
		// Object containing all CSS rules for selected theme
		let rules;
		// Object containing all CSS rules for all themes for the current selector
		let selectorRules;
		// Object containing all CSS rules for selected theme and selector
		let selectedRule;
		let openRuleString  = '{';
		let columnString    = ':';
		let newLineString   = ';';
		let closeRuleString = '}';

		// Default theme is inside the style.css, so we don't need to process themes.js if user have chosen it
		if ( 'default' !== theme )
		{
			// Loop through all selectors. themes is a global variable declared in themes.js file
			Object.keys( themes ).forEach( selector =>
			{
				// Get the object of theme rules
				selectorRules = themes[ selector ];

				// Loop them
				Object.keys( selectorRules ).forEach( selectedRule =>
				{
					// If current theme contains our theme name, then we should use the rules inside
					if ( ~selectedRule.indexOf( theme ) )
					{
						// Get rules for current theme
						rules = selectorRules[ selectedRule ];
						styles += selector.concat( openRuleString );

						// Loop through all the rules for this theme and append them to the styles string
						Object.keys( rules ).forEach( rule =>
						{
							styles += rule.concat( columnString, rules[ rule ], newLineString );
						} );

						styles += closeRuleString;
					}
				} );
			} );
		}

		// Replace old styles with the new ones
		document.getElementById( 'theme' ).innerHTML = styles;
	},

	/**
	 * Changes state of the current window (enables/disables elements and empties others if needed). It contains an
	 * object will all posible windows and their states
	 * @param {String} state Required. State which should be applied to the active window. Value of 'default' is always
	 *     available if the windows has states
	 */
	applyWindowState( state )
	{
		let window  = document.querySelector( '.window' );
		let windows = {
			'add-window'             : {
				all()
				{
					let buttons = document.getElementById( 'add-window-buttons' ).querySelectorAll( 'button' );

					buttons[ 0 ].disabled = false;
					buttons[ 1 ].disabled = false;
				},
				file()
				{
					let buttons = document.getElementById( 'add-window-buttons' ).querySelectorAll( 'button' );

					buttons[ 0 ].disabled = false;
					buttons[ 1 ].disabled = true;
				},
				'default'()
				{
					let buttons = document.getElementById( 'add-window-buttons' ).querySelectorAll( 'button' );

					buttons[ 0 ].disabled = true;
					buttons[ 1 ].disabled = true;
				}
			},
			'save-playlist-window'   : {
				save()
				{
					let buttons = document.getElementById( 'save-playlist-window-buttons' ).children;

					buttons[ 0 ].disabled = false;
					buttons[ 1 ].disabled = false;
				},
				semi()
				{
					let buttons = document.getElementById( 'save-playlist-window-buttons' ).children;
					let val     = document.getElementById( 'save-playlist-window-filename' ).value.trim();

					if ( !val )
					{
						buttons[ 0 ].disabled = false;
						buttons[ 1 ].disabled = true;
					}
					else
					{
						buttons[ 0 ].disabled = false;
						buttons[ 1 ].disabled = false;
					}
				},
				'default'()
				{
					let buttons = document.getElementById( 'save-playlist-window-buttons' ).children;

					buttons[ 0 ].disabled = true;
					buttons[ 1 ].disabled = true;

					document.getElementById( 'save-playlist-window-filename' ).value = '';
				}
			},
			'load-playlist-window'   : {
				disabled()
				{
					document.getElementById( 'load-playlist-window-buttons' ).children[ 0 ].disabled = true;
				},
				file()
				{
					document.getElementById( 'load-playlist-window-buttons' ).children[ 0 ].disabled = false;
				},
				'default'()
				{
					document.getElementById( 'load-playlist-window-buttons' ).children[ 0 ].disabled = true;
				}
			},
			'save-preferences-window': {
				save()
				{
					let buttons = document.getElementById( 'save-preferences-window-buttons' ).children;

					buttons[ 0 ].disabled = false;
					buttons[ 1 ].disabled = false;
				},
				semi()
				{
					let buttons = document.getElementById( 'save-preferences-window-buttons' ).children;
					let val     = document.getElementById( 'save-preferences-window-filename' ).value.trim();

					if ( !val )
					{
						buttons[ 0 ].disabled = false;
						buttons[ 1 ].disabled = true;
					}
					else
					{
						buttons[ 0 ].disabled = false;
						buttons[ 1 ].disabled = false;
					}
				},
				'default'()
				{
					let buttons = document.getElementById( 'save-preferences-window-buttons' ).children;

					buttons[ 0 ].disabled = true;
					buttons[ 1 ].disabled = true;

					document.getElementById( 'save-preferences-window-filename' ).value = '';
				}
			},
			'load-preferences-window': {
				disabled()
				{
					document.getElementById( 'load-preferences-window-buttons' ).children[ 0 ].disabled = true;
				},
				file()
				{
					document.getElementById( 'load-preferences-window-buttons' ).children[ 0 ].disabled = false;
				},
				'default'()
				{
					document.getElementById( 'load-preferences-window-buttons' ).children[ 0 ].disabled = true;
				}
			}
		};

		if ( window && windows[ window.id ] && windows[ window.id ][ state ] )
		{
			windows[ window.id ][ state ]();
		}
	},

	/**
	 * Attaches event listeners to all items of all playlists and to the tabs
	 */
	attachEvents()
	{
		// Attach move event. Used when moving objects around.
		document.body.addEventListener( 'mousemove', n.onBodyMove );
		document.body.addEventListener( 'mouseup', n.onBodyUp );

		// Init drag and drop functionality for local files playback
		let filedrag = document.getElementById( 'drop-zone' );

		/**
		 * Handler for mouse over on a dropzone to style it differantly
		 * @param {Event} e
		 * @private
		 */
		function _fileDragHover( e )
		{
			e.stopPropagation();
			e.preventDefault();
			e.target.className = 'dragover' === e.type ? 'hover' : '';
		}

		// Attach all event listeners for drag and drop functionality
		filedrag.addEventListener( 'dragover', _fileDragHover, false );
		filedrag.addEventListener( 'dragleave', _fileDragHover, false );
		filedrag.addEventListener( 'drop', e =>
		{
			// Cancel event and hover styling
			_fileDragHover( e );

			n.onFilesSupplied( e );
		}, false );

		// Ask for permissions if the user has checked that he wants notifications
		document.getElementById( 'preference-enable-notifications' ).addEventListener( 'change', () =>
		{
			n.notify( null, this.checked );
		} );

		// Save on playback order change
		document.getElementById( 'playback-order' ).addEventListener( 'change', () =>
		{
			n.audio.loop         = !( 2 - this.selectedIndex );
			n.pref.playbackOrder = this.selectedIndex;
		} );

		// Attach event listeners to the tabs
		let tabs             = document.querySelectorAll( '.playlists-tabs-li' );
		let inputs           = document.querySelectorAll( 'input' );
		let icons            = document.querySelectorAll( '.cloud-icon' );
		let checkboxes       = document.querySelectorAll( '#preference-cursor-follows-playback,#preference-playback-follows-cursor' );
		const clickEvent     = 'click';
		const mouseDownEvent = 'mousedown';
		const keyDownEvent   = 'keydown';
		const changeEvent    = 'change';
		const keyUpEvent     = 'keyup';

		for ( let i = tabs.length; i--; )
		{
			tabs[ i ].addEventListener( clickEvent, n.onTabClick );
			tabs[ i ].addEventListener( mouseDownEvent, n.onTabDown );
			tabs[ i ].addEventListener( keyDownEvent, n.onTabKeyDown );
		}

		// Attach event handlers to the events for changing the checkboxes for playback order in the preferences
		for ( let i = checkboxes.length; i--; )
		{
			checkboxes[ i ].addEventListener( changeEvent, n.onCheckboxChange );
		}

		// Stop bubbling to all input fields as keyboard shortcuts may prevent user from typing in them
		for ( let i = inputs.length; i--; )
		{
			inputs[ i ].addEventListener( keyDownEvent, n.stopBubbling );
		}

		// Set data-keys property for the input in which the user adds new keyboard shortcuts
		document.getElementById( 'keyboard-shortcut' ).addEventListener( keyDownEvent, e =>
		{
			let keys = n.getKeys( e );

			this.value = keys.keys.join( ' + ' );

			this.dataset.keys = keys.keyProperty.join( '+' );

			e.preventDefault();
		} );

		// Adds new keyboard shortcut to the table
		document.getElementById( 'shortcut-add' ).addEventListener( 'click', () =>
		{
			// Continue only if keyboard shortcut entered
			let input = document.getElementById( 'keyboard-shortcut' );

			if ( !input.value )
			{
				return;
			}

			// Get key combination from the input
			let keys = input.dataset.keys;

			// Alert the user if the shortcut already exists
			if ( document.getElementById( 'keyboard-shortcuts' ).querySelector( 'tr[data-keys="'.concat( keys, '"]' ) ) )
			{
				n.window( 'exists' );
			}
			// Otherwise add it to the table
			else
			{
				let insertBefore = document.getElementById( 'actions' );
				let tr           = document.createElement( 'tr' );
				let select       = document.getElementById( 'actions' );
				let tagName      = 'tr';

				// Find the position in which the row will be added
				while ( tagName !== insertBefore.tagName.toLowerCase() )
				{
					insertBefore = insertBefore.parentNode;
				}

				// Fill the row with needed atributes and HTML
				n._prepareShortcutRow(
					tr,
					keys,
					select.value,
					input.value,
					document.getElementById( 'actions' ).querySelector( 'option[value="'.concat( select.value, '"]' ) ).innerHTML
				);

				insertBefore.parentNode.insertBefore( tr, insertBefore );

				// Save preferences as new information is added
				n.pref.key = { action: select.value, key: input.getAttribute( 'data-keys' ) };
			}
		} );

		// Save preferences when user changes an input inside the preferences window
		inputs = document.getElementById( 'preferences-container' ).querySelectorAll( 'input:not(#keyboard-shortcut)' );

		let _onChange = event =>
		{
			n.pref.input = event.target;
		};

		for ( let i = inputs.length; i--; )
		{
			inputs[ i ].onchange = _onChange;
		}

		// Make Find window work
		document.getElementById( 'find-item' ).addEventListener( keyDownEvent, n.find );

		// Make X button on windows work
		document.getElementById( 'window-close' ).addEventListener( clickEvent, n.closeAll );

		/* Start: Window state events */

		// Change window state when save playlist name entered
		document.getElementById( 'save-playlist-window-filename' ).addEventListener( keyUpEvent, e =>
		{
			let val = this.value.trim();

			if ( !e.altKey && !e.altGraphKey && !e.ctrlKey && !e.shiftKey && val )
			{
				n.applyWindowState( 'save' );
			}
			else if ( !val )
			{
				n.applyWindowState( 'semi' );
			}
		} );

		// Change window state when save preferences name entered
		document.getElementById( 'save-preferences-window-filename' ).addEventListener( keyUpEvent, e =>
		{
			let val = this.value.trim();

			if ( !e.altKey && !e.altGraphKey && !e.ctrlKey && !e.shiftKey && val )
			{
				n.applyWindowState( 'save' );
			}
			else if ( !val )
			{
				n.applyWindowState( 'semi' );
			}
		} );

		/* End: Window state events */

		// Reset styles of cloud choosing icons in add/save window and select service depending on what the user clicked
		let _onIconClick = function()
		{
			let cloud = n[ this.dataset.cloud ];

			if ( cloud.isAuthenticated )
			{
				document.getElementById( 'add-window-files' ).hidden = true;
				document.getElementById( 'loading-folder-contents' ).classList.remove( 'visibility-hidden' );
				n.selectService( this.dataset.cloud );
			}
			else
			{
				cloud.connect();
			}
		};

		for ( let i = icons.length; i--; )
		{
			icons[ i ].addEventListener( clickEvent, _onIconClick );
		}

		// Listen for key presses on playlists to control the selected item/playlist
		let _onPlaylistDown = e =>
		{
			let keyCode = e.keyCode;
			let tab;
			let tabs;
			let toSelect;
			let keys    = n.getKeys( e );
			let item    = document.getElementById( 'keyboard-shortcuts' ).querySelector( 'tr[data-keys="'.concat( keys.keyProperty.join( '+' ), '"]' ) );

			// Check if we have key combination with Down happening and do nothing if we have
			if ( !item )
			{
				switch ( keyCode )
				{
					// Left
					case 37:
						// Get selected tab
						tab = document.querySelector( 'li[data-for="'.concat( n.activePlaylistId, '"]' ) );

						// Get first tab if no active tab found
						if ( !tab )
						{
							tabs = document.getElementById( 'playlists-tabs' ).querySelectorAll( 'li:not(#add-playlist)' );
							tab  = tabs.item( 0 );
						}

						// If we have one
						if ( tab )
						{
							// Get previous tab
							toSelect = tab.previousElementSibling;

							// Get last tab if no previous (we've reached the beginning)
							if ( !toSelect )
							{
								// Don't get exatly the last element, because it's the Add playlist button
								toSelect = tab.parentNode.lastElementChild.previousElementSibling;
							}

							// Select it
							n.changePlaylist( toSelect );

							// Focus is needed so next time our keydown is working
							toSelect.focus();
						}

						e.preventDefault();
						break;
					// Right
					case 39:
						// Get selected tab
						tab = document.querySelector( 'li[data-for="'.concat( n.activePlaylistId, '"]' ) );

						// Get last tab if no active tab found
						if ( !tab )
						{
							tabs = document.getElementById( 'playlists-tabs' ).querySelectorAll( 'li:not(#add-playlist)' );
							tab  = tabs.item( tabs.length - 1 );
						}

						// If we have one
						if ( tab )
						{
							// Get next tab
							toSelect = tab.nextElementSibling;

							// Get first tab if no next (we've reached the end)
							if ( 'add-playlist' === toSelect.id )
							{
								toSelect = tab.parentNode.firstElementChild;
							}

							// Select it
							n.changePlaylist( toSelect );

							// Focus is needed so next time our keydown is working
							toSelect.focus();
						}

						e.preventDefault();
						break;
					// Up
					case 38:
						// Get previous playlist item
						toSelect = n.currentlySelectedItem.previousElementSibling;

						// Get last playlist item if no previous (we've reached the beginning)
						if ( !toSelect )
						{
							toSelect = document.getElementById( n.activePlaylistId ).lastElementChild;
						}

						// Deselect items
						n._deselectItems();

						// Select chosen item
						n._selectItems.call( toSelect, {}, n.activePlaylistId, '.playlist-item', 'selected' );

						// Scroll the item into the view
						toSelect.scrollIntoView();

						e.preventDefault();
						break;
					// Down
					case 40:
						// Get previous playlist item
						toSelect = n.currentlySelectedItem.nextElementSibling;

						// Get first playlist item if no next (we've reached the end)
						if ( !toSelect )
						{
							toSelect = document.getElementById( n.activePlaylistId ).firstElementChild;
						}

						// Deselect items
						n._deselectItems();

						// Select chosen item
						n._selectItems.call( toSelect, {}, n.activePlaylistId, '.playlist-item', 'selected' );

						// Scroll the item into the view
						toSelect.scrollIntoView( false );

						e.preventDefault();
						break;
				}
			}
		};

		document.getElementById( 'playlists-wrapper' ).addEventListener( 'keydown', _onPlaylistDown );

		// We need to remember user's choice for showing or not the welcome screen
		document.getElementById( 'show-on-startup-checkbox' ).addEventListener( changeEvent, () =>
		{
			n.pref.showWelcome = this.checked;
		} );

		// We need to make animation setting work immediately
		document.getElementById( 'preference-enable-animations' ).addEventListener( changeEvent, this.initAnimations );

		// We need to enable/diable range input and buttons depending on the state of the checkbox
		document.getElementById( 'preference-enable-scrobbling' ).addEventListener( changeEvent, () =>
		{
			n.changeScrobblingState( this.checked );
		} );

		// We need to enable/diable threshold dropdown depending on the state of the checkbox
		document.getElementById( 'preference-enable-powersaver' ).addEventListener( changeEvent, () =>
		{
			n.changePowerSaverState( this.checked );
		} );

		// We need to enable/diable range input and buttons depending on the state of the checkbox
		document.getElementById( 'preference-enable-counter' ).addEventListener( changeEvent, () =>
		{
			n.changeCounterState( this.checked );
		} );

		applicationCache.addEventListener( 'updateready', () =>
		{
			if ( applicationCache.status === applicationCache.UPDATEREADY )
			{
				n.updateFound();
				applicationCache.swapCache();
			}
		}, false );

		applicationCache.addEventListener( 'cached', () =>
		{
			n.log( 'manifest-cached' );
		}, false );

		// Checking for an update. Always the first event fired in the sequence.
		applicationCache.addEventListener( 'checking', () =>
		{
			n.log( 'manifest-checking' );
		}, false );

		// An update was found. The browser is fetching resources.
		applicationCache.addEventListener( 'downloading', () =>
		{
			n.log( 'manifest-downloading' );
		}, false );

		// The manifest returns 404 or 410, the download failed,
		// or the manifest changed while the download was in progress.
		applicationCache.addEventListener( 'error', () =>
		{
			n.error( 'manifest-error' );
		}, false );

		// Fired after the first download of the manifest.
		applicationCache.addEventListener( 'noupdate', () =>
		{
			n.log( 'manifest-noupdate' );
		}, false );
	},

	/**
	 * Stops renaming of all playlists
	 */
	//TODO: Maybe this method should be called stopRenames, as cancel sounds like it returns old value, but it does not
	cancelRenames()
	{
		// Get all playlist being renamed (shouldn't be more than one, but to be sure we take all of them)
		let renamings               = document.querySelectorAll( '.renaming' );
		const contentEditableString = 'contenteditable';
		const clickEvent            = 'click';
		const emptyString           = '';

		// Iterate all and remove contentaeditable attribute, remove class and event listener for name check
		for ( let i = renamings.length; i--; )
		{
			let renaming = renamings[ i ];

			renaming.removeAttribute( contentEditableString );
			document.body.removeEventListener( clickEvent, n.playlistNameCheck );
			renaming.className = emptyString;
		}
	},

	changeCounterState( state )
	{
		let counter = document.getElementById( 'footer-counter' );

		counter.innerHTML = '';

		counter.hidden = !state || n.powerSaveMode;
	},

	/**
	 * Translates interface and saves the change.
	 */
	changeLanguage( language )
	{
		n.pref.lang = language;
		n.translate();
	},

	/**
	 * Switches active playlist to the one associated with the tab passed.
	 * @param {HTMLElement} tab Required. Tab to activate and read information about which playlist should be shown.
	 */
	changePlaylist( tab )
	{
		// Remove active tab class and hide the playlist associated with it
		let el = document.getElementById( 'playlists-tabs' ).querySelector( '.playlists-tabs-li.active' );

		if ( el )
		{
			document.getElementById( el.dataset.for ).parentNode.hidden = true;
			el.classList.remove( 'active' );
		}

		// Set clicked tab as active
		tab.classList.add( 'active' );

		// Show playlist for the clicked tab
		document.getElementById( tab.dataset.for ).parentNode.hidden = false;

		n.saveActivePlaylistIdDelayed();
	},

	/**
	 * Method to enable or disable threshold dropdown when user checks/un-checks Enable Power saver option
	 * @param {Boolean} enabled Required. State to which we should set the dropdown
	 */
	changePowerSaverState( enabled )
	{
		document.getElementById( 'power-saver-state' ).disabled = !enabled;

		// We need to change power save mode also
		if ( enabled && n.battery )
		{
			n.updateBatteryStatus();
		}
		else
		{
			n.powerSaveMode = false;
			n.applyPowerSaveMode();

			if ( n.battery )
			{
				n.updateBatteryStatus();
			}
		}
	},

	/**
	 * Method to enable or disable range input and buttons when user checks/un-checks Enable scrobbling option
	 * @param {Boolean} enabled Required. State to which we should set the range
	 */
	changeScrobblingState( enabled )
	{
		document.getElementById( 'preference-scrobbling-position' ).disabled = !enabled;

		let buttons = document.getElementById( 'preference-performance' ).querySelectorAll( '.scrobble-action' );

		for ( let i = buttons.length; i--; )
		{
			buttons[ i ].disabled = !enabled;
		}
	},

	/**
	 * Changes interface to the chosen theme and saves the preferences.
	 */
	changeStyle( theme )
	{
		n.applyTheme();
		n.pref.theme = theme;
	},

	/**
	 * Check if the user is connected to a cloud service
	 */
	checkConnections()
	{
		let toCheck = [
			'dropbox',
			'googledrive',
			'lastfm'
		];

		toCheck.forEach( cloud =>
		{
			if ( n[ cloud ].isAuthenticated )
			{
				// Some tokens expire so we need to check if they are still valid, as isAuthenticated shows only if we
				// have token
				//TODO: Maybe integrate checkToken method call inside isAuthenticated getter and return
				// true only if token is good
				n[ cloud ].checkToken( cloud =>
				{
					let as = ' <span class="as">'.concat( n.lang.console.as, '</span>', cloud.display_name );

					n.log( 'connected', cloud.name.concat( as ) );

					document.getElementById( 'connected-'.concat( cloud.codeName ) ).innerHTML = as;
				}, cloud =>
				{
					document.getElementById( 'connected-'.concat( cloud.codeName ) ).innerHTML = n.lang.console.no;

					delete n[ cloud.codeName ].accessToken;

					n.pref.accessToken = {
						cloud      : cloud.codeName,
						accessToken: null
					};

					document.getElementById( 'add-window-cloud-chooser' ).querySelector( 'a[data-cloud="' + cloud.codeName + '"]' ).dataset.notconnected = n.lang.other[ 'not-connected' ];
				} );
			}
			else
			{
				// Visualy disable the icon in file chooser for that cloud
				let icon = document.getElementById( 'add-window-cloud-chooser' ).querySelector( 'a[data-cloud="' + cloud + '"]' );

				if ( icon )
				{
					icon.dataset.notconnected = n.lang.other[ 'not-connected' ];
				}
				// Special case for Last.fm - we don't have an icon to disable, but we do have a checkbox in the
				// preferences that needs disabling
				else if ( 'lastfm' === cloud )
				{
					let checkbox     = document.getElementById( 'preference-enable-scrobbling' );
					checkbox.checked = false;
					n.changeScrobblingState( false );
					checkbox.disabled = true;
				}

				document.getElementById( 'connected-'.concat( cloud ) ).innerHTML = n.lang.console.no;
			}
		} );
	},

	/**
	 * Checks the size taken by Noisy in localStorage and issues warnings/errors if user is close or at the end of the
	 * quota
	 */
	checkQuota()
	{
		let length      = 0;
		let preferences = localStorage.getItem( 'preferences' );
		let playlists   = localStorage.getItem( 'playlists' );

		// Add preferences JSON to the length
		if ( preferences )
		{
			length += preferences.length;
		}

		// Add playlists JSON to the length
		if ( playlists )
		{
			length += playlists.length;
		}

		if ( 5200000 < length )
		{
			n.error( 'quota-limit-reached' );
		}
		else if ( 4194304 <= length )
		{
			n.warn( 'quota-limit-nearing', ( ( length / 1024 ) / 1024 ).toFixed( 2 ) + ' MB' );
		}
		else
		{
			n.log( 'quota-used', ( ( length / 1024 ) / 1024 ).toFixed( 2 ) + ' MB' );
		}
	},

	/**
	 * Clears the console.
	 */
	clearConsole()
	{
		n.console.innerHTML = '';
	},

	/**
	 * Empties inputs in the window and resets selects to 0
	 */
	clearWindow()
	{
		let inputs        = document.querySelectorAll( '#keyboard-shortcut,#save-playlist-window-filename,#save-preferences-window-filename' );
		let data          = document.querySelector( '.window' ).dataset;
		let selects       = document.querySelectorAll( '#connect-to,#add-files-service-choose,#actions' );
		const emptyString = '';

		for ( let i = inputs.length; i--; )
		{
			inputs[ i ].value = emptyString;
		}

		Object.keys( data ).forEach( key =>
		{
			delete data[ key ];
		} );

		for ( let i = selects.length; i--; )
		{
			selects[ i ].selectedIndex = 0;
		}
	},

	/**
	 * Close all kind of windows, playlist renaming, etc.
	 */
	closeAll()
	{
		n.closeWindow();
		n.closeFileFolderWindow();
	},

	/**
	 * Resets file window to default state
	 */
	closeFileFolderWindow()
	{
		let source = document.getElementById( 'add-window-files' );

		document.getElementById( 'add-window-cloud-chooser' ).hidden = false;

		source.hidden = true;

		delete source.dataset.path;
		delete source.dataset.cloud;
		delete source.dataset.filter;

		document.getElementById( 'add-window-files' ).hidden = false;
		document.getElementById( 'loading-folder-contents' ).classList.add( 'visibility-hidden' );
	},

	/**
	 * Refreshes playlists/statusbar/window title if it need to.
	 */
	closePreferences()
	{
		if ( n.shouldRefreshPlaylist )
		{
			n.refreshPlaylists();
		}

		if ( n.shouldRefreshStatusBar )
		{
			n.refreshStatusbar();
		}

		if ( n.shouldRefreshWindowTitle )
		{
			n.refreshWindowTitle();
		}

		let confirmation = document.getElementById( 'preferences-window-buttons' ).querySelectorAll( '.confirmation' );

		if ( confirmation.length )
		{
			confirmation[ 0 ].classList.remove( 'confirmation' );
		}
	},

	/**
	 * Close opened window and execute closePreferences if opened window is Preferences window.
	 */
	closeWindow()
	{
		let window = document.querySelector( '.window' );
		let id     = window.id;

		if ( id )
		{
			n.applyWindowState( 'default' );

			// Apply settings if any
			if ( 'preferences-window' === id )
			{
				n.closePreferences();
			}
			// Empty find window
			else if ( 'find-window' === id )
			{
				document.getElementById( 'find-item' ).value = '';
				n.initSearch( '' );
			}
			// Stop video on welcome window, if user have closed it
			else if ( 'welcome-window' === id )
			{
				//TODO: What if the video is not on the first slide? Better find the iframe, get the index and use it
				// instead
				document.getElementById( 'welcome-window-content' ).children[ 0 ].innerHTML = n.lang.welcome[ 0 ];
			}

			// Timeout is needed for the CSS transition to finish before hiding the window
			setTimeout( () =>
			{
				window.removeAttribute( 'id' );
			}, 300 );

			// Remove other classes from the window
			//todo: Do we actually change this class somewhere?
			window.className = 'window';

			n.clearWindow();

			// Remove slideshow interval
			clearInterval( n.slideshow );
		}
	},

	/**
	 * Connects to a cloud service.
	 */
	connect()
	{
		n.window( 'connect-window' );
	},

	/**
	 * Calls connect method for the chosen cloud service.
	 */
	connectTo()
	{
		n[ document.getElementById( 'connect-to' ).value ].connect();
	},

	/**
	 * Creates tab and playlist elements in the DOM and selects the newly
	 * created playlist
	 *
	 * @param {String} name Required. Name of the playlist.
	 * @param {String} id Required. Playlist id. Format: playlist-{unix_time}
	 * @param {Boolean} [save] Optional. Should the playlist be saved after it's creation.
	 */
	createPlaylist( name, id, save )
	{
		// Remove unwanted empty characters in the beginning and at the end of the name
		name = name.trim();

		// Create the tab
		let tab = document.createElement( 'li' );

		tab.dataset.for  = id;
		tab.dataset.name = name;
		tab.classList.add( 'playlists-tabs-li' );
		tab.tabIndex  = 0;
		tab.innerHTML = '<span>'.concat( name, '</span> <a href="javascript:;" class="playlist-edit"><span data-icon="!"></span></a> <a href="javascript:;" class="playlist-remove">&times;</a>' );

		let triggers = tab.querySelectorAll( 'a' );

		triggers[ 0 ].addEventListener( 'click', n.renamePlaylist );
		triggers[ 1 ].addEventListener( 'click', n.deletePlaylist );

		document.getElementById( 'playlists-tabs' ).insertBefore( tab, document.getElementById( 'add-playlist' ) );

		tab.addEventListener( 'click', n.onTabClick );
		tab.addEventListener( 'mousedown', n.onTabDown );
		tab.addEventListener( 'keydown', n.onTabKeyDown );

		// Create the playlist
		let playlist = document.createElement( 'li' );

		playlist.hidden    = true;
		playlist.innerHTML = '<article id="'.concat( id, '" data-name="', name, '" class="row playlist scroll-y" onscroll="n.saveActivePlaylistIdDelayed()"></article>' );

		document.getElementById( 'playlists' ).appendChild( playlist );

		// Save the playlist if needed
		if ( save )
		{
			n.savePlaylists();
		}

		// Remove tab view if only one tab
		n.oneTabCheck();

		return tab;
	},

	/**
	 * Returns first item from user's selection if available or the first item of the playlist.
	 * @returns {HTMLElement}
	 */
	get currentlySelectedItem()
	{
		return n.currentlySelectedItems[ 0 ] || document.getElementById( n.activePlaylistId ).children[ 0 ];
	},

	/**
	 * Returns a list of items selected by the user.
	 * @returns {NodeList}
	 */
	get currentlySelectedItems()
	{
		return document.getElementById( n.activePlaylistId ).querySelectorAll( '.selected' );
	},

	/**
	 * Deletes the selected item from the active playlist.
	 */
	deleteItems( item )
	{
		let toDelete = item ? [ item ] : n.currentlySelectedItems;
		let len      = toDelete.length;

		// Delete only if selected item(s) found
		for ( let i = len; i--; )
		{
			let selected = toDelete[ i ];
			selected.parentNode.removeChild( selected );
		}

		// Save playlist if selected items(s) found
		if ( len )
		{
			n.savePlaylist( document.getElementById( n.activePlaylistId ) );
		}
	},

	/**
	 * Deletes playlist.
	 *
	 * @this {HTMLElement} Element should be the X button inside the tab.
	 */
	deletePlaylist( tab )
	{
		tab = tab.tagName ? tab : this.parentNode;

		let toActivate = tab.previousElementSibling || tab.nextElementSibling;
		let playlist   = document.getElementById( tab.dataset.for );

		// If we have closed last tab and we don't have next tab to activate, we need to show to the user the hints
		// screen
		if ( document.getElementById( 'add-playlist' ) === toActivate )
		{
			toActivate                                         = null;
			document.getElementById( 'playlist-hints' ).hidden = false;
		}

		// Should continue only if both tab and playlist elements are found
		if ( tab && playlist )
		{
			// Remove event listeners
			let triggers = tab.querySelectorAll( 'a' );

			triggers[ 0 ].removeEventListener( 'click', n.renamePlaylist, false );
			triggers[ 1 ].removeEventListener( 'click', n.deletePlaylist, false );
			tab.removeEventListener( 'click', n.onTabClick, false );
			tab.removeEventListener( 'mousedown', n.onTabDown, false );
			tab.removeEventListener( 'keydown', n.onTabKeyDown, false );

			// Remove DOM elements
			tab.parentNode.removeChild( tab );
			playlist = playlist.parentNode;
			playlist.parentNode.removeChild( playlist );

			// Save change
			n.savePlaylists();

			// Remove tab view if only one tab
			n.oneTabCheck();
		}
		// Otherwise throw an error
		else
		{
			//TODO: Add n.error() here
			console.error( 'deletePlaylist: tab or playlist not found' );
		}

		// Activate tab after deletion, if there are remaining tabs
		if ( toActivate )
		{
			n.changePlaylist( toActivate );
		}
		// Otherwise save in the preferences that we shouldn't search to playlist to focus next time Noisy loads
		else
		{
			n.pref.activePlaylistId = null;
		}
	},

	/**
	 * Detect what codecs are supported by the browser.
	 */
	detectFormats()
	{
		// Continue only if never detected this session
		if ( !n.formats.length )
		{
			// Possible codecs
			let types = [
				'audio/mpeg;', 'audio/ogg; codecs="vorbis"', 'audio/wav; codecs="1"',
				'audio/mp4; codecs="mp4a.40.2"'
			];

			types.forEach( type =>
			{
				// Add as supported if browser says it can be played
				if ( n.audio.canPlayType( type ).replace( /no/, '' ) )
				{
					n.formats.push( type.split( ';' )[ 0 ] );
				}
			} );
		}
	},

	/**
	 * Removes all files listed on the file dialog.
	 */
	//TODO: Maybe combine this with closeFileFolderWindow()?
	emptyAddWindow()
	{
		let items            = document.querySelectorAll( '.add-item' );
		const mouseDownEvent = 'mousedown';
		const dblClickEvent  = 'dblclick';

		for ( let i = items.length; i--; )
		{
			let item = items[ i ];
			item.removeEventListener( mouseDownEvent, n.onAddItemDown );
			item.removeEventListener( dblClickEvent, n.onAddItemDblClick );
		}

		document.getElementById( 'add-window-files' ).innerHTML = '';
	},

	/**
	 * Removes all items from playback's queue.
	 */
	//TODO: This method is not used. Do we need it?
	emptyQueue()
	{
		let queue           = n.queue;
		let item;
		const emptyString   = '';
		const classToRemove = 'is-in-queue';

		for ( let i = queue.length; i--; )
		{
			item = queue[ i ];

			item.querySelector( '.item-queue' ).innerHTML = emptyString;

			// Remove queue mark from item
			item.classList.remove( classToRemove );
		}

		n.queue.length = 0;
	},

	/**
	 * Adds an error line to the console.
	 *
	 * @param {String} section Required. Contains property name in the
	 * language object for the action we are logging.
	 * @param {String} data Required. Text to be printed in the console.
	 */
	error( section, data = '' )
	{
		n.console.innerHTML += '<div class="nb-error"><span class="'.concat( section, '">', n.lang.console[ section ], '</span>', data, '</div>' );
		document.getElementById( 'header-right' ).lastElementChild.classList.add( 'nb-error' );
	},

	/**
	 * Fills playlist with items and eventualy saves it
	 *
	 * @param {String} id Required. Id of the playlist to be filled.
	 * @param {Array} items Required. Array of objects with all items to be filled to the playlist.
	 * @param {Boolean} [save] Optional. Save the playlist if available and true.
	 */
	fillPlaylist( id, items, save )
	{
		// Will append all items to a document fragment first - much faster that way
		let df                  = document.createDocumentFragment();
		const elementToCreate   = 'section';
		const tabIndexString    = 'tabindex';
		const cloudString       = 'dropbox';
		const cannotPlayClass   = 'can-not-play';
		const initialHTML       = '<div class="playback-options"><div class="item-queue"></div><div class="playback-status"></div><div class="item-add-to-queue" data-icon="Q"></div><div class="item-remove-from-queue" data-icon="P"></div></div><div class="item-title"></div>';
		const playlistItemClass = 'playlist-item';
		const dblClickEvent     = 'dblclick';
		const mouseDownEvent    = 'mousedown';

		items.forEach( itm =>
		{
			// DOM item itself
			let item = document.createElement( elementToCreate );

			// Add tab index as we need it to know which is the last selected item in
			//the calculations for multiple select with shiftkey
			item.setAttribute( tabIndexString, 0 );

			// This is only for now, as we do not support any other service than Dropbox
			itm.cloud = itm.cloud || cloudString;

			// Setting all available attributes to the DOM item
			Object.assign( item.dataset, itm );

			// Check if current item is supported by the browser
			let mimeType = itm.mimetype;

			if ( mimeType && !~n.formats.indexOf( mimeType ) )
			{
				item.classList.add( cannotPlayClass );
			}

			// Add styling classes
			item.classList.add( playlistItemClass );

			// Format title as Artist - Title string if either of the two is available
			item.innerHTML = initialHTML;
			n.renderItem( item );

			item.addEventListener( dblClickEvent, n.onRowDblClick );
			item.addEventListener( mouseDownEvent, n.onRowDown );

			// Append the item to the fragment
			df.appendChild( item );
		} );

		// Append the fragment to the playlist
		document.getElementById( id ).appendChild( df );

		// Save if we have to
		if ( save )
		{
			n.savePlaylist( document.getElementById( id ) );
		}
	},

	/**
	 * Searches for items.
	 *
	 * @param {Event} e Required. Event for the input element in which
	 * the search term is entered. Searching is done only when Enter key is pressed.
	 */
	find( e )
	{
		let results;
		let selected;
		let idx;
		let mousedownEvent = document.createEvent( 'MouseEvent' );
		let mouseupEvent   = document.createEvent( 'MouseEvent' );
		let val;

		// We need mouse events because we need to trigger mousedown/mouseup events on playlist items, so they get
		// highlighted
		//TODO: Find something smarter
		mousedownEvent.initMouseEvent( 'mousedown', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null );
		mouseupEvent.initMouseEvent( 'mouseup', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null );

		// Enter pressed
		if ( 13 === e.keyCode )
		{
			val = document.getElementById( 'find-item' ).value.toLowerCase().trim();

			// If user pressed Enter again, without changing the search term, we need to initiate play on the selected
			// item
			if ( n.lastSearchTerm === val )
			{
				n.play();
			}
			else
			{
				// Search for term
				n.initSearch( n.lastSearchTerm = val );

				// Select first result
				results = document.getElementById( 'find-window-results' ).querySelectorAll( '.playlist-item' );

				if ( results.length )
				{
					// Select first item in results window
					results[ 0 ].dispatchEvent( mousedownEvent );
					results[ 0 ].dispatchEvent( mouseupEvent );
				}
			}
		}
		// Up key pressed
		else if ( 38 === e.keyCode )
		{
			results = document.getElementById( 'find-window-results' ).querySelectorAll( '.playlist-item' );

			if ( results.length )
			{
				// Get selected item
				selected = document.getElementById( 'find-window-results' ).querySelector( '.selected' );

				// Find it's index in the parent's children
				idx = Array.prototype.indexOf.call( results, selected );

				// Check if we are the first item and select the last one if true
				if ( 0 > idx - 1 )
				{
					results[ results.length - 1 ].dispatchEvent( mousedownEvent );
					results[ results.length - 1 ].dispatchEvent( mouseupEvent );
				}
				else
				{
					results[ idx - 1 ].dispatchEvent( mousedownEvent );
					results[ idx - 1 ].dispatchEvent( mouseupEvent );
				}
			}
		}
		// Down key pressed
		else if ( 40 === e.keyCode )
		{
			results = document.getElementById( 'find-window-results' ).querySelectorAll( '.playlist-item' );

			if ( results.length )
			{
				// Get selected item
				selected = document.getElementById( 'find-window-results' ).querySelector( '.selected' );

				// Find it's index in the parent's children
				idx = Array.prototype.indexOf.call( results, selected );

				// Check if we are the last item and select the first one if true
				if ( results.length <= idx + 1 )
				{
					results[ 0 ].dispatchEvent( mousedownEvent );
					results[ 0 ].dispatchEvent( mouseupEvent );
				}
				else
				{
					results[ idx + 1 ].dispatchEvent( mousedownEvent );
					results[ idx + 1 ].dispatchEvent( mouseupEvent );
				}
			}
		}
		// Esc key pressed
		else if ( 27 === e.keyCode )
		{
			n.closeAll();
		}
	},

	/**
	 * Formats string by replacing %property% with value of data-property.
	 *
	 * @param {String} string Required. String to be formated.
	 * @param {HTMLElement} item Required. Playlist item from which to read data properties.
	 *
	 * @return {String} Formated string.
	 */
	formatString( string, item )
	{
		// Find if artist, album, title and date are required in the supplied string
		let needed  = {
			artist: /%artist%/g.exec( string ),
			album : /%album%/g.exec( string ),
			title : /%title%/g.exec( string ),
			date  : /%date%/g.exec( string )
		};
		// Count how many of the of the tag we are not using
		let notUsed = 0;

		// Loop through tags to format them
		Object.keys( needed ).forEach( tag =>
		{
			let regEx = needed[ tag ];

			// Create regex for current tag if needed
			let replaceEx = regEx ? new RegExp( regEx[ 0 ], 'g' ) : '';

			// Replace the tag with the value if found
			if ( regEx && item.dataset[ tag ] )
			{
				string = string.replace( replaceEx, item.dataset[ tag ] );
			}
			// Otherwise if we have the regex, but not the value, replace the tag with an empty space and count it as
			// not used;
			else if ( regEx )
			{
				string = string.replace( replaceEx, '' );
				notUsed++;
			}
			// And finally if nothing worked, this means this tag is not used and not required, so only count as not
			// used;
			else
			{
				notUsed++;
			}
		} );

		// If all tags are counted as not used, then use the placeholder string as a result;
		if ( 4 === notUsed )
		{
			string = item.dataset.placeholder;
		}

		return string;
	},

	/**
	 * Gets all of the items in a playlist.
	 * @param {String} [playlist] Optional. Id of the playlist we want all items
	 * from. If not playlist supplied, currently active one will be used.
	 * @returns {NodeList} Items of the playlist.
	 */
	getAllItems( playlist = n.activePlaylistId )
	{
		return document.getElementById( n.activePlaylistId ).querySelectorAll( '.playlist-item' );
	},

	/**
	 * Get cloud name from passed item
	 *
	 * @param {HTMLElement} item Required. Playlist item from which to read the cloud name
	 *
	 * @return {String} Cloud service name
	 */
	getCloud( item )
	{
		return item.dataset.cloud;
	},

	/**
	 * Returns item based on the playlist passed.
	 *
	 * @param {String} [playlist] Optional. Id of the playlist from which the item will be picked.
	 * @param {Number} [idx] Optional. Index of the item to be returned. If
	 * not supplied the selected item will be returned.
	 *
	 * @return {HTMLElement} Playlist item.
	 */
	getItem( playlist, idx )
	{
		// Cannot continue if playlist is not supplied, so get the id of the active item
		return idx ? n.getAllItems( playlist ).item( idx ) : n.currentlySelectedItem;
	},

	/**
	 * Gets all the pressed keyboard keys.
	 *
	 * @param {Event} e Required. Keyboard event from which keyCodes will be read.
	 *
	 * @return {Object} Object containing both keyCodes and names of the pressed keys.
	 */
	getKeys( e )
	{
		// Contains keyCode items
		let keyProperty = [];
		// Contains human readable key names
		let keys        = [];

		if ( e.altKey )
		{
			keys.push( keyCodes[ 18 ] );
			keyProperty.push( 18 );
		}
		if ( e.ctrlKey )
		{
			keys.push( keyCodes[ 17 ] );
			keyProperty.push( 17 );
		}
		if ( e.shiftKey )
		{
			keys.push( keyCodes[ 16 ] );
			keyProperty.push( 17 );
		}
		if ( e.metaKey )
		{
			keys.push( keyCodes[ 91 ] );
			keyProperty.push( 91 );
		}
		if ( 16 !== e.keyCode && 17 !== e.keyCode && 18 !== e.keyCode && 91 !== e.keyCode )
		{
			keys.push( keyCodes[ e.keyCode ] );
			keyProperty.push( e.keyCode );
		}

		return { keys, keyProperty };
	},

	/**
	 * Get the URL from an item.
	 * @param {HTMLElement} [item] Optional. Playlist item from which to read the URL.
	 * @return {String} URL to the file.
	 */
	//TODO: This method is not used. Do we need it?
	getURLFromItem( item = n.currentlySelectedItem )
	{
		return item ? item.dataset.url : null;
	},

	/**
	 * NB initialization function. Called on window load
	 */
	init( callback )
	{
		// Before everything, if user is using the appspot domain, we should redirect him to https://www.noisyplayer.com
		if ( ~location.host.indexOf( 'appspot' ) )
		{
			location.replace( 'https://www.noisyplayer.com' );
		}

		// Switch to Dev channel if user wants to
		if ( n.pref.devChannel && !~location.pathname.indexOf( '/dev/' ) )
		{
			location.replace( '//' + location.host + '/dev/' + location.hash + location.search );
		}

		n.initBatteryWatcher( () =>
		{
			n.markNotSupportedPreferences();
			n.applyPowerSaveMode();
		} );

		n.initAudio();
		n.pref.process();

		// Set the counter for lastfm
		n.updateScrobbleCounter();

		// Set language
		n.initFAQ();
		n.translate();
		n.changeScrobblingState( n.pref.settings.checkboxes[ 'preference-enable-scrobbling' ] );

		//TODO: currently we are saving preferences twice - can we optimize smartly?
		const hash              = location.hash;
		const search            = location.search;
		let split               = [];
		const accessTokenString = 'access_token=';
		const codeString        = 'code=';
		const tokenString       = 'token=';
		const equalString       = '=';
		const clickEvent        = 'click';
		const mouseDownEvent    = 'mousedown';
		const keyDownEvent      = 'keydown';
		const dblClickEvent     = 'dblclick';

		if ( hash && '#' !== hash )
		{
			split = hash.split( '#' ).pop().split( '&' );
		}
		else if ( search && '?' !== search )
		{
			split = search.split( '?' ).pop().split( '&' );
		}

		for ( let i = split.length; i--; )
		{
			let part = split[ i ];

			// Dropbox and Google Drive are returning directly the access token
			if ( 0 === part.indexOf( accessTokenString ) )
			{
				let accessToken = part.split( equalString ).pop();

				n[ n.pref.tokenCloud ].accessToken = accessToken;

				n.pref.accessToken = { cloud: n.pref.tokenCloud, accessToken };

				break;
			}
			// Last.fm returns the token as "token" param and requires a special session token to be generated
			else if ( 0 === part.indexOf( tokenString ) )
			{
				let token = part.split( equalString ).pop();

				n[ n.pref.tokenCloud ].getAccessToken( token, xhr =>
				{
					let response = JSON.parse( xhr.responseText );

					n[ n.pref.tokenCloud ].userName    = response.session.name;
					n[ n.pref.tokenCloud ].accessToken = response.session.key;

					n.pref.userName    = {
						cloud   : n.pref.tokenCloud,
						userName: response.session.name
					};
					n.pref.accessToken = {
						cloud      : n.pref.tokenCloud,
						accessToken: response.session.key
					};
				}, () =>
				{
					n.error( 'error-getting-access-token', n[ n.pref.tokenCloud ].name );
				} );

				break;
			}
			// Box is returning code with which we should request the access token
			else if ( 0 === part.indexOf( codeString ) )
			{
				n[ n.pref.tokenCloud ].getAccessToken( part.split( equalString ).pop() );

				break;
			}
		}

		// Make sure our URL is clean
		let pathname = location.pathname;

		if ( ~pathname.indexOf( '/dev/' ) )
		{
			pathname = '/dev/';
		}
		else
		{
			pathname = '/';
		}

		history.pushState( { clear: 'hash' }, 'without refresh', pathname );
		history.pushState( { clear: 'search' }, 'without refresh', pathname );

		// Check to which cloud services the user is connected to
		//if( 'localhost' != location.host && '127.0.0.1' != location.host )
		{
			n.checkConnections();
		}

		n.applyTheme();

		// Load all available playlists
		n.loadAndRenderPlaylists();

		// Check how much space user took from the 5MB quota of localStorage
		n.checkQuota();

		// Resume where user left
		if ( n.pref.activePlaylistId )
		{
			let playlist = document.getElementById( n.pref.activePlaylistId );

			if ( playlist )
			{
				let scrollTop = n.pref.scrollTop;

				// Let the rendering engine catchup
				setTimeout( () =>
				{
					playlist.scrollTop = scrollTop;
				}, 0 );

				n.changePlaylist( document.querySelector( 'li[data-for="'.concat( n.pref.activePlaylistId, '"]' ) ) );
			}
			else
			{
				n.warn( 'missing-element', n.pref.activePlaylistId );
			}
		}

		// Attach events to the DOM elements of the player
		n.attachEvents();

		// Attach menu events
		let menuItems    = document.querySelectorAll( 'a[data-menulistener]' );
		let prefTabs     = document.querySelectorAll( '.preferences-item' );
		let _onItemClick = function( e )
		{
			// Stop bubbling otherwise the window (if any) opened will be immediately closed
			e.stopPropagation();

			// Close all previous file browsing windows. Need in case user have entered in file browser (lets say
			// Save playlist) and tries to open another one (lets say Load playlist). We need to re-initialize the
			// add files window in original state
			n.closeFileFolderWindow();

			// Execute needed method
			n[ this.dataset.menulistener ].call( this );
		};
		let _onTabClick  = function()
		{
			// Check if user clicked on the active tab already and stop execution if true
			if ( this.classList.contains( 'active' ) )
			{
				return;
			}

			// Get all preference tabs contents
			let preferences = document.getElementById( 'preferences-container' ).children;
			let len         = preferences.length;

			// Remove active class from active tab
			document.getElementById( 'preferences-tabs' ).querySelector( '.active' ).classList.remove( 'active' );

			// Add active class to clicked tab
			this.classList.add( 'active' );

			// Hide all tab contents
			for ( let i = len; i--; )
			{
				preferences[ i ].hidden = true;
			}

			// Show content for selected tab
			document.getElementById( 'preference-'.concat( this.dataset.preference ) ).hidden = false;
		};

		for ( let i = menuItems.length; i--; )
		{
			menuItems[ i ].addEventListener( clickEvent, _onItemClick );
		}

		// Attach preferences items events
		for ( let i = prefTabs.length; i--; )
		{
			prefTabs[ i ].addEventListener( clickEvent, _onTabClick );
		}

		// Attach progress bar events
		document.getElementById( 'progress' ).addEventListener( mouseDownEvent, e =>
		{
			n.moving       = true;
			n.movingBar    = this;
			n.movingStartX = e.clientX;
		} );
		document.getElementById( 'volume' ).addEventListener( mouseDownEvent, e =>
		{
			n.moving           = true;
			n.movingBar        = this;
			n.movingStartX     = e.clientX;
			n.movingShouldSave = true;
		} );

		// Catch click on body and close windows if any
		document.body.addEventListener( clickEvent, n.closeAll );

		// Catch click on .window and stop bubbling, so we do not close the window on click
		document.querySelector( '.window' ).addEventListener( clickEvent, n.stopBubbling );

		// Listen for keyboard shortcuts and execute them if found.
		document.body.addEventListener( keyDownEvent, e =>
		{
			let keys = n.getKeys( e );
			let item = document.getElementById( 'keyboard-shortcuts' ).querySelector( 'tr[data-keys="'.concat( keys.keyProperty.join( '+' ), '"]' ) );

			if ( item )
			{
				n[ item.dataset.action ]();
				e.preventDefault();
			}

			// Close everything if Esc is pressed
			if ( 27 === e.keyCode )
			{
				n.closeAll();
				e.preventDefault();
			}
		} );

		// Double click on footer should bring the currently active item into the view
		document.getElementById( 'footer' ).addEventListener( dblClickEvent, () =>
		{
			let activeItem = n.activeItem;
			let parentItem;
			let id;

			if ( activeItem )
			{
				parentItem = activeItem.parentNode;
				id         = parentItem.id;

				// Focus the tab in which the active item is
				if ( id !== n.activePlaylistId )
				{
					n.changePlaylist( document.querySelector( 'li[data-for="'.concat( id, '"]' ) ) );
				}

				// Scroll item into view
				scrollIntoViewIfOutOfView( activeItem );
			}
		} );

		// We need to stop the bubbling so if the user is renaming the playlist it won't get saved while moving the
		// caret to a new location with the mouse
		document.getElementById( 'playlists-tabs' ).addEventListener( clickEvent, e =>
		{
			n.closeAll();
			n.stopBubbling.call( this, e );
		} );

		// Double click on the tabs means either rename of playlist (if playlist tab was double clicked) or create new
		// playlist, so need to listen for dblclick
		document.getElementById( 'playlists-tabs' ).addEventListener( dblClickEvent, function( e )
		{
			if ( this === e.target )
			{
				n.newPlaylist();
			}
			else
			{
				n.renamePlaylist( e.target );
			}
		} );

		// Need to listen for Enter and Esc keys when renaming
		document.getElementById( 'playlists-tabs' ).addEventListener( keyDownEvent, e =>
		{
			let keyCode  = e.keyCode;
			let renaming = document.querySelector( 'li[data-for="'.concat( n.activePlaylistId, '"] span.renaming' ) );

			// Shouldn't do anything if we are not renaming
			if ( !renaming )
			{
				return;
			}

			if ( 13 === keyCode )
			{
				e.preventDefault();
				n.playlistNameCheck();
			}
			else if ( 27 === keyCode )
			{
				e.preventDefault();

				let name = e.target;

				name.innerHTML = name.parentNode.dataset.name;

				n.cancelRenames();
			}
		} );

		// Print current version into the About box
		document.getElementById( 'version' ).innerHTML = n.version;

		// Init the welcome screen
		n.initWelcome();

		if ( n.pref.showWelcome )
		{
			n.showWelcome();
		}

		// Calculate time needed for Noisy to load
		let timerEnd = Date.now();
		n.log( 'startup', timerEnd - timerStart + '<span class=\'ms\'>'.concat( n.lang.console.ms, '</span>' ) );

		// Construct todays date as last check for updates, as browser does check at first automatically
		n.lastUpdateCheck = Math.floor( +new Date() / 86400000 );

		// n.googledrive.youTubeSearch( 'Metallica One' );

		callback();
	},

	/**
	 * Adds animations if user enabled the option.
	 */
	initAnimations()
	{
		// Enable animations only if user said so
		let rules = [];

		if ( !n.powerSaveMode && n.pref.settings.checkboxes[ 'preference-enable-animations' ] )
		{
			rules = [
				//TODO: Make separate rules for all the animations, because this wildcard selector is far from optimal
				'*:not(.delete-icon){transition: all .3s linear}',
				'.playback-status[data-icon=\'w\'],#loading-folder-contents-icon,#youtube-search-window-content:empty:after{width: 30px;height: 30px;-webkit-animation-name: spin;-webkit-animation-duration: 1s;-webkit-animation-iteration-count: infinite;-webkit-animation-timing-function: linear;animation-name: spin;animation-duration: 1s;animation-iteration-count: infinite;animation-timing-function: linear}'
			];
		}

		document.getElementById( 'animations' ).innerHTML = rules.join( '' );
	},

	/**
	 * Setups the HTML Audio element.
	 */
	initAudio()
	{
		n.audio.preload = 'auto';

		n.audio.id = 'audio';

		document.body.appendChild( n.audio );

		// When player can play it should
		n.audio.addEventListener( 'canplay', function()
		{
			// Play if active audio is paused and inactive audio is not selected. This happens when playing for the
			// first time
			if ( n.audio.paused )
			{
				this.play();
			}
		} );

		// Change state of the item to playing when the player is playing
		n.audio.addEventListener( 'play', function()
		{
			let idx        = parseInt( this.dataset.item, 10 );
			let playlistId = this.dataset.playlist;
			let item;
			let bold       = document.getElementById( 'playlists' ).querySelector( '.bold' );

			// Remove bold from previous element, if available
			if ( bold )
			{
				bold.classList.remove( 'bold' );
			}

			// Enable preloading of items when updateMeters is called and the progress is more than 50%
			//TODO: This is for knowing if we should initiate pre-load next time counters get updated. Maybe we can
			// find another way to do that without flags?
			n.preloaded = false;

			// If we have index for first item we need to play it
			if ( 'number' === typeof idx && !isNaN( idx ) )
			{
				//TODO: Get rid of this index thingy - too unstable if user changes positions of items
				item = document.getElementById( playlistId ).querySelectorAll( '.playlist-item' )[ idx ];
				n.setItemState( 'x', false, item );

				// Check if item is first in the queue
				if ( item === n.queue[ 0 ] )
				{
					// Remove queue number
					item.querySelector( '.item-queue' ).innerHTML = '';

					n.queue.splice( 0, 1 );

					// Remove queue mark from item if not queued again
					if ( !~n.queue.indexOf( item ) )
					{
						item.classList.remove( 'is-in-queue' );
					}

					n.updateQueueStates();
				}

				item.classList.add( 'bold' );
				n.setTitle( item );
				n.setFooter( item );
				n.notify( item );

				if ( n.lastfm.isAuthenticated )
				{
					n.lastfm.updateNowPlaying( item );
				}

				n.audio.dataset.start = Math.floor( +new Date() / 1000 );

				n.log( 'playbackStart', item.dataset.placeholder );
			}

			n.updateMeters();
		} );

		// Change state of the item to paused when the player is paused
		n.audio.addEventListener( 'pause', () =>
		{
			n.setItemState( 'c', false, document.getElementById( n.audio.dataset.playlist ).querySelectorAll( '.playlist-item' )[ parseInt( n.audio.dataset.item, 10 ) ] );
		} );

		// Play next item when current finnishes
		n.audio.addEventListener( 'ended', function()
		{
			let item = document.getElementById( this.dataset.playlist ).querySelectorAll( '.playlist-item' )[ parseInt( this.dataset.item, 10 ) ];
			let next = n.next( 'next', true );

			// Remove bold from currently playing item
			item.classList.remove( 'bold' );

			n.setItemState( null, false, item );

			if ( n.lastfm.isAuthenticated )
			{
				n.lastfm.scrobble();
			}

			if ( next )
			{
				n[ next.dataset.cloud ].play( next );
			}
		} );

		// Detect codecs support
		n.detectFormats();
	},

	/**
	 * Watches battery levels and enters power saving mode if user chose so when battery level is low
	 *
	 * @param {Function} callback Required. Callback introduced to mark the power save option in Preferences as active
	 */
	initBatteryWatcher( callback )
	{
		function attachEvents()
		{
			n.battery.addEventListener( 'chargingchange', n.updateBatteryStatus );
			n.battery.addEventListener( 'levelchange', n.updateBatteryStatus );

			// Delay initial set, to wait for the proper Noisy initialization
			setTimeout( n.updateBatteryStatus, 1000 );

			callback();
		}

		// Check for newer specification of Battery API
		if ( navigator.getBattery )
		{
			navigator.getBattery().then( battery =>
			{
				n.battery = battery;
				attachEvents();
			} );
		}
		// Otherwise use the old one
		else
		{
			n.battery = navigator.battery || navigator.mozBattery || navigator.webkitBattery;
			if ( n.battery )
			{
				attachEvents();
			}
		}
	},

	/**
	 * Renders HTML for FAQ section in the About window
	 */
	initFAQ()
	{
		let q    = n.lang.faq.q;
		let html = '';

		q.forEach( ( q, i ) =>
		{
			html += '<details><summary id="q-'.concat( i + 1, '"></summary><p id="a-', i + 1, '"></p></details>' );
		} );

		document.getElementById( 'faq-content' ).innerHTML = html;
	},

	/**
	 * Fills find window with items containing search term entered by the user.
	 */
	initSearch( val )
	{
		let results          = document.getElementById( 'find-window-results' );
		const mouseDownEvent = 'mousedown';
		const dblClickEvent  = 'dblclick';
		const _cleanup       = () =>
		{
			let oldResults = document.getElementById( 'find-window-results' ).querySelectorAll( '.playlist-item' );

			// Remove listeners from old results
			for ( let i = oldResults.length; i--; )
			{
				oldResults[ i ].removeEventListener( mouseDownEvent, n.onRowDown, false );
				oldResults[ i ].removeEventListener( dblClickEvent, n.onRowDblClick, false );
			}

			// Clear old results
			results.innerHTML = '';
		};

		if ( val )
		{
			let items = document.getElementById( 'playlists' ).querySelectorAll( 'li:not([hidden]) section[data-url]' );

			// We'll search by all words, so we split them
			let terms = val.split( ' ' );

			// Remove old search results
			_cleanup();

			// Loop through all playlist items
			for ( let i = 0; i < items.length; i++ )
			{
				let item  = items[ i ];
				let url   = item.dataset.url.toLowerCase();
				// By default we have a match
				let match = true;
				let term;
				let title = item.querySelector( '.item-title' ).innerHTML.toLowerCase();

				// Loop through all search terms (words)
				for ( let j = terms.length; j--; )
				{
					term = terms[ j ];

					// If this term is not found in current item, mark item as not suitable and move on
					if ( !~url.indexOf( term ) && !~title.indexOf( term ) )
					{
						match = false;
						break;
					}
				}

				// Clone found item, if any, and append the cloning to the results
				if ( match )
				{
					let cloning  = item.cloneNode( true );
					let duration = cloning.children[ 2 ];

					// Remove queue and duration elements from the cloning
					cloning.removeChild( cloning.children[ 0 ] );

					if ( duration )
					{
						cloning.removeChild( duration );
					}

					results.appendChild( cloning );

					// Add event listeners for the cloning
					cloning.addEventListener( mouseDownEvent, n.onRowDown );
					cloning.addEventListener( dblClickEvent, n.onRowDblClick );
				}
			}
		}
		else
		{
			_cleanup();
		}
	},

	/**
	 * Initializes sliding functionality on welcome page and all features in them.
	 */
	initWelcome()
	{
		let slides = n.lang.welcome;
		let df     = document.createDocumentFragment();
		let slide;

		slides.forEach( ( s, i ) =>
		{
			slide = document.createElement( 'div' );

			slide.id = 'welcome-slide-' + i;

			// Add unique class name to all slides so we can select them later
			slide.classList.add( 'welcome-slide' );

			// Hide slide if not first one
			if ( i )
			{
				slide.classList.add( 'visibility-hidden' );
			}

			slide.innerHTML = slides[ i ];

			df.appendChild( slide );
		} );

		// Append all slides to the DOM
		document.getElementById( 'welcome-window-content' ).appendChild( df );

		// Update slide counter
		document.getElementById( 'welcome-slide-counter' ).innerHTML = '1'.concat( '/', slides.length );

		// Update Noisy version
		//		document.getElementById( 'welcome-version' ).innerHTML = n.version;

		// Place the logo in the slides
		document.getElementById( 'welcome-window-logo' ).src = document.getElementById( 'largest-logo' ).href;

		if ( n.pref.showWelcome )
		{
			this.slideshow = setInterval( () =>
			{
				let button = document.getElementById( 'welcome-slide-next' );
				if ( !button.disabled )
				{
					n.changeSlide( 1, true );
				}
				else
				{
					clearInterval( n.slideshow );
				}
			}, 5000 );
		}

		/*var todoCount = 0,
		 filesToCheck = [
		 'bg.js'
		 , 'cloud.js'
		 , 'dropbox.js'
		 , 'en.js'
		 , 'googledrive.js'
		 , 'index.html'
		 , 'lang.js'
		 , 'main.js'
		 , 'player.js'
		 , 'style.css'
		 , 'themes.js'
		 ],
		 progressCounter = 0;

		 // Check all listed above files for TODOs and count them
		 filesToCheck.forEach( function( file )
		 {
		 var xhr = new XMLHttpRequest();

		 xhr.onreadystatechange = function()
		 {
		 if( 4 === xhr.readyState )
		 {
		 if( 200 === xhr.status )
		 {
		 var count = xhr.responseText.match( /TODO(:)/g );
		 if( count )
		 {
		 todoCount += count.length;
		 }
		 if( filesToCheck.length == ++progressCounter )
		 {
		 document.getElementById( 'todos-left' ).innerHTML = todoCount;
		 }
		 }
		 }
		 };

		 xhr.open( 'GET', file, true );
		 xhr.send();
		 } );*/
	},

	/**
	 * Loads all the playlists in localStorage and renders them.
	 */
	loadAndRenderPlaylists()
	{
		let playlists = n.loadPlaylists();

		// Continue only if there are playlists saved
		if ( playlists )
		{
			const errorString = 'error-loading-playlist';
			const emptyString = '';

			// Iterate through all the saved playlists
			for ( let i = playlists.length; i--; )
			{
				// Shorthand for current playlist
				let playlist = playlists[ i ];

				if ( !playlist || !playlist.id || !playlist.name || !playlist.items )
				{
					n.error( errorString, playlist ? ( playlist.id || playlist.name || emptyString ) : emptyString );
					return;
				}

				// Create tab and playlist DOM elements
				n.createPlaylist( playlist.name, playlist.id, false );

				// Fill the playlist with the saved data
				n.fillPlaylist( playlist.id, playlist.items, false );
			}
		}
	},

	/**
	 * Creates and fills playlist with loaded data passed as an arguments.
	 * @param {Object} playlist Required. Playlist object containing id, name and items properties
	 */
	loadPlaylist( playlist )
	{
		// Cannot continue if id, name and items properties are not available or the playlist param is not passed
		if ( !playlist || !playlist.id || !playlist.name || !playlist.items )
		{
			n.error( 'error-loading-playlist', playlist ? ( playlist.id || playlist.name || '' ) : '' );
			return;
		}

		let tab = document.querySelector( 'li[data-for="'.concat( playlist.id, '"]' ) );

		if ( tab )
		{
			// Delete playlist because it'll be recreated again.
			n.deletePlaylist( tab );
		}

		n.createPlaylist( playlist.name, playlist.id );
		n.fillPlaylist( playlist.id, playlist.items, true );
	},

	/**
	 * Loads all saved playlists.
	 *
	 * @return {Object} Array with playlists if playlist found, otherwise null.
	 */
	loadPlaylists()
	{
		// Load playlists
		let playlists = localStorage.getItem( 'playlists' );

		// Parse JSON and retrun value
		if ( playlists )
		{
			return JSON.parse( playlists );
		}
		// Otherwise return null
		else
		{
			//todo: Maybe return empty array to keep returned value consistent and remove useless checks on other places
			return null;
		}
	},

	/**
	 * Gets first selected item from files window and sends it to the corresponding cloud object to try loading it as a
	 * playlist.
	 */
	loadPlaylistFromCloud()
	{
		let src      = document.getElementById( 'add-window-files' );
		let selected = src.querySelectorAll( '.active' );
		let cloud    = src.dataset.cloud;

		if ( cloud )
		{
			for ( let i = selected.length; i--; )
			{
				n[ cloud ].loadPlaylist( selected[ i ] );
			}
		}

		n.closeAll();
	},

	/**
	 * Gets first selected item from files window and sends it to the corresponding cloud object to try loading it as
	 * preferences.
	 */
	loadPreferencesFromCloud()
	{
		let src      = document.getElementById( 'add-window-files' );
		let selected = src.querySelectorAll( '.active' );
		let cloud    = src.dataset.cloud;

		if ( selected.length && cloud )
		{
			n[ cloud ].loadPreferences( selected[ 0 ] );
		}

		n.closeFileFolderWindow();
	},

	/**
	 * Adds a line to the console.
	 * @param {String} section Required. Contains property name in the
	 * language object for the action we are logging.
	 * @param {String} data Required. Text to be printed in the console.
	 */
	log( section, data = '' )
	{
		n.console.innerHTML += '<div><span class="'.concat( section, '">', n.lang.console[ section ], '</span>', data, '</div>' );
	},

	/**
	 * Extracts the data from a playlist and prepares it to be saved later.
	 * @param {String} id Required. Id of the playlist to be processed.
	 * @return {Array} Array of objects containing item's data
	 */
	makePlaylistItems( id )
	{
		// Select playlist's items
		let items  = document.getElementById( id ).querySelectorAll( '.playlist-item:not([data-cloud="local"])' );
		let toSave = [];

		// Iterate all items
		for ( let i = items.length; i--; )
		{
			// Clone dataset object into a new one
			toSave.push( Object.assign( {}, items[ i ].dataset ) );
		}

		// Return the array of objects as a result
		return toSave;
	},

	/**
	 * Some features are known not to work on some browsers, so we have to mark them as not supported and disable them
	 */
	markNotSupportedPreferences()
	{
		if ( !n.battery )
		{
			document.getElementById( 'preference-enable-powersaver' ).disabled = true;
			document.getElementById( 'preference-performance-powersaver' ).classList.add( 'not-supported' );
		}

		if ( 'undefined' === typeof Notification )
		{
			document.getElementById( 'preference-enable-notifications' ).disabled = true;
			document.getElementById( 'preference-performance-notifications' ).classList.add( 'not-supported' );
		}
	},

	/**
	 * Create playlist.
	 */
	newPlaylist()
	{
		let name = n.lang.other[ 'new-playlist' ];
		let tab  = n.createPlaylist( name, 'playlist-' + +new Date(), true );

		if ( tab )
		{
			n.renamePlaylist( tab.querySelector( 'span' ) );
		}
	},

	/**
	 * Chooses previous/next item depending on the playback order set by the user.
	 * Next song may not be chosen if the song is the last in the
	 * playlist.
	 */
	next( direction, shouldReturn )
	{
		// Do nothing if there is loading item
		if ( n.waitingItem )
		{
			return;
		}

		// Get current item and set next item to null
		let item     = n.activeItem;
		let next     = null;
		let selected = n.currentlySelectedItem;
		let idx      = document.getElementById( 'playback-order' ).selectedIndex;

		// If user wants to repeat the same item don't do anything - audio.loop is set to true
		if ( 2 === idx )
		{
			return;
		}

		// Assume next item if no direction is passed
		if ( 'string' !== typeof direction )
		{
			direction = 'next';
		}

		// Reset title/statusbar to default if not returning the item in the end
		if ( !shouldReturn )
		{
			n.setTitle( null, true );
			n.setFooter( null, true );
		}

		// Cannot continue if current item is not found
		if ( !item )
		{
			return;
		}

		// Play next song depending on user's selection if any
		if ( document.getElementById( 'preference-playback-follows-cursor' ).checked && selected && 4 !== idx )
		{
			next = selected;
		}
		else if ( 'next' === direction && n.queue.length )
		{
			next = n.queue[ 0 ];
		}

		if ( !next )
		{
			// Choose next item depending on the playback order set by the user
			switch ( idx )
			{
				// Default mode
				case 0:
					next = item[ direction.concat( 'Sibling' ) ];
					break;

				// Repeat playlist mode
				case 1:
					next = item[ direction.concat( 'Sibling' ) ];
					if ( !next )
					{
						next = n.getAllItems();

						// Get the last item if previous item is required
						if ( 'previous' === direction )
						{
							next = next.item( next.length - 1 );
						}
						else
						{
							next = next.item( 0 );
						}
					}
					break;

				// Random mode
				case 3:
					let items = n.getAllItems();
					next      = items[ Math.floor( ( Math.random() * items.length ) ) ];
					break;
			}
		}
		// Otherwise set player to stop state, but only if not being set to return as pre-loading shouldn't brake
		// visualization of currently playing item
		else if ( !shouldReturn )
		{
			n.setItemState();
		}

		// Return next item if requested
		if ( shouldReturn )
		{
			return next;
		}

		// Remove state classes from current item
		if ( item )
		{
			n.setItemState();
		}

		// Put state classes to next item and play it if available
		if ( next )
		{
			next.querySelector( '.playback-status' ).dataset.icon = 'w';
			n.play( next );
		}
		// Otherwise stop HTML Audio if it is paused (used to stop the
		// player when it's paused and user clicked next, but no next
		// is chosen because of the playing order)
		else if ( !n.audio.paused )
		{
			n.stop();
		}
	},

	/**
	 * Plays a random item by manipulating the playback order.
	 */
	nextRandom()
	{
		// Get playback order and save it for later use
		let order = document.getElementById( 'playback-order' );
		let idx   = order.selectedIndex;

		// Set the playback order to Random
		order.selectedIndex = 3;

		// Play the next song
		n.next();

		// Return the playback order to the previous setting
		order.selectedIndex = idx;
	},

	/**
	 * Show next slide on Welcome screen and update button state.
	 * @param {String} direction Required. Direction in which the slideshow will go.
	 * @param {Boolean} doNotClear Required. Flag showing if interval for slideshow should be stopped or not.
	 */
	changeSlide( direction, doNotClear )
	{
		// Stop slideshow
		if ( !doNotClear )
		{
			clearInterval( n.slideshow );
		}

		// Get current style
		let currentSlide = document.getElementById( 'welcome-window-content' ).querySelector( '.welcome-slide:not(.visibility-hidden)' );
		// Parent node of our slides
		let parent       = currentSlide.parentNode;
		// Get it's index among it's siblings
		let idx          = parseInt( currentSlide.id.split( '-' ).pop(), 10 );
		// Slide number
		let slide        = idx + 1 + direction;
		// Get next slide
		let next         = currentSlide.parentNode.children[ idx + direction ];

		// Check if we are the last slide in that direction
		if ( !next )
		{
			// Set next slide depending on the direction
			slide = direction > 0 ? 0 : parent.childElementCount - 1;
			next  = parent.children.item( slide++ );
		}

		requestAnimationFrame( () =>
		{
			// Hide current slide
			currentSlide.classList.add( 'visibility-hidden' );

			// Reset content of the slide being hidden to the default, if it contains iframe (video). This will stop
			// video if played.
			if ( currentSlide.querySelectorAll( 'iframe' ).length )
			{
				setTimeout( () =>
				{
					currentSlide.innerHTML = n.lang.welcome[ idx ];
				}, 500 );
			}

			// Show next slide
			next.classList.remove( 'visibility-hidden' );

			// Update counter in the welcome footer
			document.getElementById( 'welcome-slide-counter' ).innerHTML = ''.concat( slide, '/' + next.parentNode.childElementCount );
		} );
	},

	/**
	 * Pop a desktop notification to the user with the item being played.
	 * @param {HTMLElement} [item] Optional. Item from which we need to get the information shown in the notification.
	 *     If not supplied the active item will be chosen.
	 * @param {Boolean} [request] Optional. If true only a permission request will be sent to the user.
	 */
	notify( item = n.activeItem, request )
	{
		// We don't do notifications if we are in power save mode
		if ( !n.powerSaveMode )
		{
			// Request desktop notification permission if not already and user wants to
			if ( request && 'undefined' !== typeof Notification && Notification.permission !== 'granted' )
			{
				Notification.requestPermission( status =>
				{
					if ( Notification.permission !== status )
					{
						Notification.permission = status;
					}
				} );
			}
			else if ( 'undefined' === typeof request && n.pref.notify )
			{
				// If the user agreed to get notified
				if ( Notification && Notification.permission === 'granted' )
				{
					let notification = new Notification( n.lang.other[ 'notification-title' ], {
						icon: document.getElementById( 'notify-logo' ).href,
						body: n.formatString( document.getElementById( 'preference-notification-popup-format' ).value, item )
					} );

					notification.onshow = function()
					{
						setTimeout( notification.close.bind( this ), 3000 );
					};
				}

				// If the user hasn't told if he wants to be notified or not
				// Note: because of Chrome, we are not sure the permission property
				// is set, therefore it's unsafe to check for the "default" value.
				else if ( 'undefined' !== typeof Notification && Notification.permission !== 'denied' )
				{
					Notification.requestPermission( status =>
					{
						if ( Notification.permission !== status )
						{
							Notification.permission = status;
						}

						// If the user said okay
						if ( status === 'granted' )
						{
							let notification = new Notification( n.lang.other[ 'notification-title' ], {
								icon: document.getElementById( 'notify-logo' ).href,
								body: n.formatString( document.getElementById( 'preference-notification-popup-format' ).value, item )
							} );

							notification.onshow = function()
							{
								setTimeout( notification.close.bind( this ), 3000 );
							};
						}
					} );
				}
			}
		}
	},

	/**
	 * Handler for mousedown event in the files window.
	 * @param {Event} e Required.
	 */
	onAddItemDown( e )
	{
		// Need to remove all selected items if current item is being selected without Ctrl/Shift keys (without
		// multi-selection)
		if ( !e.ctrlKey && !e.shiftKey )
		{
			let items          = document.getElementById( 'add-window-files' ).querySelectorAll( '.add-item' );
			const activeString = 'active';

			for ( let i = items.length; i--; )
			{
				items[ i ].classList.remove( activeString );
			}
		}

		n._selectItems.call( this, e, 'add-window-files', '.add-item', 'active' );

		// Apply windows state depending on if the item chosen is a file or folder
		if ( 'false' === this.dataset.folder )
		{
			n.applyWindowState( 'file' );
		}
		else
		{
			n.applyWindowState( 'all' );
		}
	},

	/**
	 * Handler for dblclick event in the files window.
	 */
	onAddItemDblClick()
	{
		// Open folder if item is a folder
		if ( 'true' === this.dataset.folder )
		{
			n.openFolder();
		}
		// Otherwise load file depending on the type of the file window
		else
		{
			let id = document.querySelector( '.window' ).id;

			switch ( id )
			{
				case 'load-playlist-window':
					n.loadPlaylistFromCloud();
					break;
				case 'load-preferences-window':
					n.loadPreferencesFromCloud();
					break;
				default:
					n.addFileFolder();
			}
		}
	},

	/**
	 * Event handler called on mouse move over the body. Used for dragging elements.
	 * @param {Event} e Required. Mouse event from which data will be extracted and used in calculations.
	 */
	onBodyMove( e )
	{
		let idx;
		let itm;
		let diff;
		let items;
		let width;
		let x;
		let boundingRect;

		// Continue only if playlist item is being moved by the user
		if ( n.moving && n.movingItem )
		{
			// Get y position of the mouse
			let y = e.clientY;

			// Get the difference between current mouse position and starting one
			diff = n.movingStartY - y;

			// Move item in the DOM only if it's moved more than it's height
			if ( Math.abs( diff ) > n.movingItemHeight )
			{
				items = n.getAllItems();

				// Move the item in the right direction on the Y axis
				if ( 0 < diff )
				{
					// Get index of currently dragged item
					idx = Array.prototype.indexOf.call( items, n.movingItem );

					// Check if there is previous item
					itm = items[ idx - 1 ];

					// Move dragged item only if there is item to place it before
					if ( itm )
					{
						n.movingItem.parentNode.insertBefore( n.movingItem, itm );

						// Save new starting position
						n.movingStartY = y;

						// Indicate that save should be happen on drag end
						n.movingShouldSave = true;
					}
				}
				else
				{
					// Get index of currently dragged item
					idx = Array.prototype.indexOf.call( items, n.movingItem );

					// Check if there is next item
					itm = items[ idx + 1 ];

					// Move dragged item only if there is item to place it before
					if ( itm )
					{
						n.movingItem.parentNode.insertBefore( n.movingItem, itm.nextSibling );

						// Save new starting position
						n.movingStartY = y;

						// Indicate that save should be happen on drag end
						n.movingShouldSave = true;
					}
				}
			}
		}
		// Otherwise check if a tab is being moved
		else if ( n.moving && n.movingTab )
		{
			// Tabs are dragged only horizontaly, so get current mouse position on X axis
			x     = e.clientX;
			// Get the difference between current mouse position and starting one
			diff  = n.movingStartX - x;
			items = document.querySelectorAll( '.playlists-tabs-li' );

			// Move the item in the right direction on the X axis
			if ( 0 > diff )
			{
				// Get index of currently dragged item
				idx = Array.prototype.indexOf.call( items, n.movingTab );

				// Check if there is next item
				itm = items[ idx + 1 ];

				// Move dragged item only if there is item to place it before
				if ( itm && 'add-playlist' !== itm.id )
				{
					// Get next item's width
					width = itm.offsetWidth;

					// Move item in the DOM only if moved over the whole next element
					if ( Math.abs( diff ) > width )
					{
						n.movingTab.parentNode.insertBefore( n.movingTab, itm.nextSibling );

						// Save new starting position
						n.movingStartX = x;

						// Indicate that save should be happen on drag end
						n.movingShouldSave = true;
					}
				}
			}
			else
			{
				// Get index of currently dragged item
				idx = Array.prototype.indexOf.call( items, n.movingTab );

				// Check if there is previous item
				itm = items[ idx - 1 ];

				// Move dragged item only if there is item to place it before
				if ( itm && 'add-playlist' !== itm.id )
				{
					// Get previous item's width
					width = itm.offsetWidth;

					// Move item in the DOM only if moved over the whole previous element
					if ( Math.abs( diff ) > width )
					{
						n.movingTab.parentNode.insertBefore( n.movingTab, itm );

						// Save new starting position
						n.movingStartX = x;

						// Indicate that save should be happen on drag end
						n.movingShouldSave = true;
					}
				}
			}
		}
		// If not, then check for progress bar drag
		else if ( n.moving && n.movingBar )
		{
			if ( e.target === n.movingBar || e.target.parentNode === n.movingBar )
			{
				// Progress bars are dragged only horizontaly, so get current mouse position on X axis
				boundingRect = n.movingBar.getBoundingClientRect();
				x            = e.pageX - boundingRect.left;

				// Get the width of the bar
				width = n.movingBar.offsetWidth;

				// Calculate the differance
				let tmp = Math.max( 0, x );

				diff = Math.min( tmp, width );

				// Convert it into percents
				let percents = diff * 100 / width;

				// Set audio progress if playback's progress bar is being dragged
				if ( 'progress' === n.movingBar.id && !n.audio.paused )
				{
					n.audio.currentTime = n.audio.duration * percents / 100;

					// Set bar only if playing
					n.setProgress( n.movingBar, percents );
				}
				// Otherwise if volume's bar is dragged, then set audio volume
				else if ( 'volume' === n.movingBar.id )
				{
					n.pref.volume = percents / 100;
				}
			}
		}
	},

	/**
	 * Event handler called on mouse up over the body. Used for dragging elements.
	 *
	 * @param {Event} e Required. Mouse event from which data will be extracted and used in calculations.
	 */
	//TODO: This code looks very much alike the code for bodyMove
	onBodyUp( e )
	{
		let x;
		let width;
		let diff;
		let percents;
		let boundingRect;

		// If we have moved a progress bar. This code is used in case when
		//the user only clicks on the bar and does NOT drag it.
		if ( n.movingBar )
		{
			// Set audio progress if moved bar was playback's progress bar
			if ( 'progress' === n.movingBar.id && !n.audio.paused )
			{
				boundingRect        = n.movingBar.getBoundingClientRect();
				x                   = e.pageX - boundingRect.left;
				width               = n.movingBar.offsetWidth;
				diff                = Math.min( Math.max( 0, x ), width );
				percents            = diff * 100 / width;
				n.audio.currentTime = n.audio.duration * percents / 100;

				// Set bar only if playing
				n.setProgress( n.movingBar, percents );
			}
			// Otherwise set audio volume if volume progress bar was moved
			else if ( 'volume' === n.movingBar.id )
			{
				boundingRect = n.movingBar.getBoundingClientRect();
				x            = e.pageX - boundingRect.left;
				width        = n.movingBar.offsetWidth;

				diff          = Math.min( Math.max( 0, x ), width );
				percents      = diff * 100 / width;
				n.pref.volume = percents / 100;
			}
		}

		// Save if something has changed
		if ( n.movingShouldSave )
		{
			if ( n.movingItem )
			{
				n.savePlaylist( document.getElementById( n.activePlaylistId ) );
			}
			else if ( n.movingTab )
			{
				n.savePlaylists();
			}
			else if ( n.movingBar && 'volume' === n.movingBar.id )
			{
				n.pref.volume = percents / 100;
			}
		}

		// Reset variables as drag is over
		n.moving     = false;
		n.movingItem = n.movingTab = n.movingBar = null;
		n.movingItemHeight = n.movingStartY = n.movingStartX = -1;
	},

	/**
	 * On delete keyboard shortcut click event handler. Deletes the
	 * row from the DOM and saves the preferences.
	 *
	 * @param {HTMLElement} button. Buttom clicked.
	 */
	onDeleteKeyboardShortcut( button )
	{
		// Get the row on which the delete button was clicked
		let row = button.parentNode.parentNode;

		// Get row index
		let idx = Array.prototype.indexOf.call( row.parentNode.children, row );

		// Remove the row
		row.parentNode.removeChild( row );

		// Save preferences
		n.pref.deleteKey = idx;
	},

	/**
	 * Event handler called on click on the one tab setting in the preferences window.
	 * Toggles visibility on the tabs if only one tab is available.
	 */
	oneTabCheck()
	{
		if (
			document.getElementById( 'preference-hide-playlist-tabs' ).checked &&
			2 === document.querySelectorAll( '.playlists-tabs-li' ).length
		)
		{
			document.body.classList.add( 'one-tab' );
		}
		else
		{
			document.body.classList.remove( 'one-tab' );
		}
	},

	/**
	 * Calls changeLanguage() with the selected value of the language dropdown.
	 *
	 * @param {HTMLElement} select Required. HTML select element from which the value will be taken.
	 */
	//TODO: Maybe in index.html use
	//<select id="preference-user-language" onchange="n.changeLanguage(this.value)">
	//instead of
	//<select id="preference-user-language" onchange="n.onLanguageChange(this)">
	//and drop this function
	onLanguageChange( select )
	{
		n.changeLanguage( select.value );
	},

	/**
	 * List folder contents in the files window.
	 */
	openFolder()
	{
		let selected = document.getElementById( 'add-window-files' ).querySelector( '.active' );

		document.getElementById( 'add-window-files' ).hidden = true;
		document.getElementById( 'loading-folder-contents' ).classList.remove( 'visibility-hidden' );

		n[ selected.dataset.cloud ].getFolderContents( selected.dataset.path );
	},

	/**
	 * Handler for change event on all checkboxes in the preferences window.
	 */
	onCheckboxChange()
	{
		let checked = this.checked;

		// If one of the two checkboxes is checked, un-check the other
		if ( 'preference-cursor-follows-playback' === this.id && checked )
		{
			document.getElementById( 'preference-playback-follows-cursor' ).checked = false;
		}
		else if ( 'preference-playback-follows-cursor' === this.id && checked )
		{
			document.getElementById( 'preference-cursor-follows-playback' ).checked = false;
		}
	},

	/**
	 * Handles local files supplied by the user.
	 * @param {Event} e Required. Event from which to get the files.
	 * @returns {boolean}
	 */
	onFilesSupplied( e )
	{
		let files      = e.files || e.dataTransfer.files;
		let filesArray = [];
		let id         = n.activePlaylistId;

		// Create new playlist to which to add the files if the user hasn't selected any
		if ( !id )
		{
			n.newPlaylist();
			id = n.activePlaylistId;
		}

		// FileReader is asyncronious so we need to handle the loop through asyncLoop
		asyncLoop( files.length - 1, loop =>
		{
			let fr        = new FileReader();
			let fileToAdd = {};

			function _handleFileLoad()
			{
				let tags = n.powerSaveMode ? {} : n.readTags( this.result, fileToAdd.placeholder.split( '.' ).pop() );

				// Copy the tags to the file
				Object.assign( fileToAdd, tags );

				// Stop listening for file loaded as we are going to attach a new listener next time
				fr.removeEventListener( 'load', _handleFileLoad );

				loop.next();
			}

			// Start listening for when current file is loaded
			fr.addEventListener( 'load', _handleFileLoad );

			n.local.files[ id ] = n.local.files[ id ] || [];

			let file = files[ loop.index ];

			// File in the fillPlaylist format
			fileToAdd = {
				cloud      : 'local',
				//TODO: Check if browser supports there formats instead of replacing them, and if it is - add them to
				//the first check, so we have them in n.formats
				mimetype   : file.type.replace( 'mp3', 'mpeg' ).replace( 'x-m4a', 'mp4' ),
				placeholder: file.name,
				url        : loop.index
			};

			filesArray.push( fileToAdd );
			n.local.files[ id ].push( file );

			// We don't read the file if we are in power save mode
			if ( n.powerSaveMode )
			{
				_handleFileLoad();
			}
			// Otherwise start file read
			else
			{
				fr.readAsArrayBuffer( file );
			}
		}, () =>
		{
			n.fillPlaylist( id, filesArray, false );
			n.closeAll();
		} );

		return false;
	},

	onPowerSaverStateChange( select )
	{
		n.pref.powerSaverState = select.value;
		n.updateBatteryStatus();
	},

	/**
	 * On item double click event handler. Plays the clicked item.
	 * @this {HTMLElement} Item clicked.
	 */
	onRowDblClick()
	{
		n.setItemState();

		if ( 'find-window-results' === this.parentNode.id )
		{
			n.play();
		}
		else
		{
			n.play( this );
		}
	},

	/**
	 * Event handler called on mouse down over playlist item. Used for dragging items.
	 * @param {Event} e Required. Mouse event from which data will be extracted and used in calculations.
	 * @this {HTMLElement} Playlist item.
	 */
	onRowDown( e )
	{
		let clickedElement = e.target;
		let row            = e.currentTarget;

		// Delete selected items if the user has clicked on the trash can on some of them, then on the confirm icon
		if ( row.classList.contains( 'confirmation' ) && clickedElement.classList.contains( 'delete-icon' ) )
		{
			return n.deleteItems();
		}
		// Otherwise add confirmation to the row
		else if ( clickedElement.classList.contains( 'delete-icon' ) )
		{
			return row.classList.add( 'confirmation' );
		}
		// Otherwise check if user clicked add to queue icon and add the item to the queue if true
		else if ( clickedElement.classList.contains( 'item-add-to-queue' ) )
		{
			return n.addToQueue( this );
		}
		// If not, check if user clicked remove from queue icon and remove the item from the queue
		else if ( clickedElement.classList.contains( 'item-remove-from-queue' ) )
		{
			return n.removeFromQueue( this );
		}

		requestAnimationFrame( () =>
		{
			// Deselect previous items if not in a multi-select mode
			if ( !e.ctrlKey && !e.shiftKey )
			{
				n._deselectItems();
			}

			// Select clicked item depending on the keyboard keys pressed
			n._selectItems.call( this, e, n.activePlaylistId, '.playlist-item', 'selected' );

			// Manage search results, if window is opened
			if ( 'find-window-results' === this.parentNode.id )
			{
				let toSelect        = document.querySelectorAll( '.window .selected' );
				const selectedClass = 'selected';
				const selectorStart = 'section[data-url="';
				const selectorEnd   = '"]';
				let selected        = document.querySelectorAll( '#'.concat( n.activePlaylistId, ' .selected' ) );

				// Deselect all selected items from the current playlist
				for ( let i = selected.length; i--; )
				{
					selected[ i ].classList.remove( selectedClass );
				}

				for ( let i = toSelect.length; i--; )
				{
					document.getElementById( n.activePlaylistId ).querySelector( selectorStart.concat( toSelect[ i ].dataset.url, selectorEnd ) ).classList.add( selectedClass );
				}

				let el = document.getElementById( n.activePlaylistId ).querySelector( 'section[data-url="'.concat( this.dataset.url, '"]' ) );

				el.classList.add( selectedClass );

				scrollIntoViewIfOutOfView( el );
			}
		} );

		// Set variables needed for onBodyMove()
		n.moving           = true;
		n.movingItem       = this;
		n.movingItemHeight = this.offsetHeight;
		n.movingStartY     = e.clientY;
	},

	/**
	 * Event handler called on change of theme dropdown. Used for changing themes.
	 * @param {HTMLElement} select Required. HTML select element from which theme name will be taken.
	 */
	onStyleChange( select )
	{
		// Change the theme of Noisy
		n.changeStyle( select.value );
	},

	/**
	 * On tab click event handler. Switches tabs.
	 * @this {HTMLElement} Tab clicked.
	 */
	onTabClick()
	{
		requestAnimationFrame( () =>
		{
			if ( 'add-playlist' === this.id )
			{
				n.newPlaylist();
			}
			else
			{
				n.changePlaylist( this );
			}
		} );
	},

	/**
	 * Event handler called on mouse down over tab item. Used for dragging tabs.
	 * @param {Event} e Required. Mouse event from which data will be extracted and used in calculations.
	 */
	onTabDown( e )
	{
		// Set variables needed for onBodyMove()
		n.moving       = true;
		n.movingTab    = this;
		n.movingStartX = e.clientX;
	},

	/**
	 * Stop bubbling of all keys except Enter and Esc when renaming.
	 * @param {Event} e Required.
	 */
	onTabKeyDown( e )
	{
		let keyCode  = e.keyCode;
		let renaming = e.target.classList.contains( 'renaming' );

		if (
			renaming &&
			13 !== keyCode &&
			27 !== keyCode
		)
		{
			n.stopBubbling( e );
		}
	},

	/**
	 * Plays an item.
	 *
	 * @param {*} [item] Optional. If an HTMLElement is passed, it'll
	 * be used to read data from it and play it. Otherwise selected item
	 * will be chosen as data source.
	 */
	play( item = {} )
	{
		// Check if we are paused and only un-pause so
		if ( n.activeItem && n.audio.paused )
		{
			return n.playPause();
		}

		// Check if HTMLElement is passed and use selected if not. Play
		// button's click event points here, so item can be event object.
		if ( !item.tagName )
		{
			item = n.currentlySelectedItem;

			// There is no selected item, so we cannot continue
			if ( !item )
			{
				return;
			}
		}

		// Select item if cursor follows playback
		if ( document.getElementById( 'preference-cursor-follows-playback' ).checked )
		{
			n._deselectItems();
			n._selectItems.call( item, {}, n.activePlaylistId, '.playlist-item', 'selected' );
		}

		let cloud = n.getCloud( item );

		// Initialize player if not already
		if ( !n.audio.parentNode )
		{
			n.initAudio();
		}

		// Authenticate with cloud service if not already
		if ( !n[ cloud ].isAuthenticated )
		{
			// Connect to the cloud service
			return n[ cloud ].connect();
		}

		n.log( 'playbackWait', item.dataset.placeholder );

		n.setTitle( item );
		n.setFooter( item );

		// Load file from cloud service
		n[ cloud ].play( item );

		// Each time user plays something, we check for updates
		let now = Math.floor( +new Date() / 86400000 );

		if ( now > n.lastUpdateCheck )
		{
			applicationCache.update();
			n.lastUpdateCheck = now;
		}
	},

	/**
	 * Check if name is not empty and create playlist
	 */
	playlistNameCheck()
	{
		let title  = document.querySelector( 'li[data-for="'.concat( n.activePlaylistId, '"] span' ) );
		let name   = title.innerHTML.trim();
		let rename = title.dataset.rename;

		// Remove event listener, as next time rename is issued, this event listener will be attached again
		document.body.removeEventListener( 'click', n.playlistNameCheck );

		if ( name )
		{
			// Are we renaming an existing playlist?
			if ( rename )
			{
				document.getElementById( n.activePlaylistId ).dataset.newname = name;
				n.savePlaylist( document.getElementById( n.activePlaylistId ), false, true );
				n.cancelRenames();

				// Need to save preferences, as new id is generated and after refresh, there won't be an element with
				// the old id to focus it
				n.pref.activePlaylistId = n.activePlaylistId;
			}
			// or we are creating a new one
			else
			{
				if ( n.createPlaylist( name, n.activePlaylistId, true ) )
				{
					// Close window only if everything went well
					n.cancelRenames();
				}
			}
		}
	},

	/**
	 * Pause/Resume HTML Audio playback.
	 */
	playPause()
	{
		// Check if paused and play if it is
		if ( n.audio.paused && n.activeItem )
		{
			n.audio.play();
		}
		// otherwise pause
		else if ( n.activeItem )
		{
			n.audio.pause();
		}
	},

	/**
	 * Plays the video and stops the slideshow from sliding
	 * @param {HTMLElement} container Required. Element from which to read the HTML needed to replace the existing one
	 */
	playSlideshowVideo( container )
	{
		clearInterval( n.slideshow );
		container.innerHTML = container.dataset.iframe;
	},

	/**
	 * Calls next method with previous direction.
	 */
	prev()
	{
		// Next item should be the previous one, so tell that to next()
		n.next( 'previous' );
	},

	/**
	 * Reads tags for MP3, OGG and M4A files.
	 * @param {ArrayBuffer} buffer Required. File represented in an array buffer.
	 * @param {String} extension Required. File extension. Used to determine which algorithm to apply when reading tags.
	 * @returns {Object} All read tags.
	 */
	readTags( buffer, extension )
	{
		let dv       = new DataView( buffer );
		let toGet    = {};
		let i;
		let j;
		let k;
		let charCode;
		let matchCharCode;
		let tag;
		let tagCode;
		let match;
		let str;
		let tagLength;
		let tagValue = [];
		let mimeType = 'unknown';
		let len;
		let nextMatch;
		let metadata = {};

		// Choose algorithm
		switch ( extension )
		{
			case 'mp3':
				mimeType = 'audio/mpeg';
				// We need only these tags for now
				toGet    = {
					'TPE1': 'artist', //'TPE2'
					'TIT2': 'title',
					'TALB': 'album',
					'TYER': 'date'
				};
				len      = Object.keys( toGet ).length;
				i        = 0;

				// Loop first 1000 bytes
				while ( i < 1000 && len )
				{
					charCode = dv.getUint8( i++ );

					Object.keys( toGet ).forEach( tag =>
					{
						tagCode = tag.charCodeAt( 0 );

						// Check for lower case match
						if ( charCode === tagCode )
						{
							match = true;
							// loop through all letters to make sure we have found a match
							for ( k = 1; k < tag.length; k++ )
							{
								matchCharCode = dv.getUint8( ( i - 1 ) + k );
								tagCode       = tag.charCodeAt( k );
								if ( matchCharCode !== tagCode )
								{
									match = false;
									break;
								}
							}

							// If a match is found get the tag
							if ( match )
							{
								// Pattern for tag: TALB 00 00 00 (HEX for length of tag in bytes, grouped
								// by 2 for each char, the second being the first part in unicode, eg. 0415
								// for cyrillic ? is written 15 04 here) 00 00 (unicode flag byte. If 00 then
								// no unicode, else it's the first part of unicode char) (tag itself)
								tagLength       = i + 9 + dv.getUint8( i + 6 );
								tagValue.length = 0;
								// Check for *ÿþ symbols and read after them if found
								i               = ( 255 === dv.getUint8( i + 10 ) && 254 === dv.getUint8( i + 11 ) ) ? i + 12 : i + 9;

								// First byte shows if the tag is encoded in Unicode or not
								matchCharCode = dv.getUint8( i++ );

								// If unicode
								if ( matchCharCode )
								{
									nextMatch = ( '00' + dv.getUint8( i - 1 ).toString( 16 ) ).slice( -2 );
									while ( i <= tagLength )
									{
										matchCharCode = ( '00' + dv.getUint8( i ).toString( 16 ) ).slice( -2 );
										tagValue.push( '0x'.concat( matchCharCode, nextMatch ) );
										nextMatch = ( '00' + dv.getUint8( i + 1 ).toString( 16 ) ).slice( -2 );
										i += 2;
									}
								}
								else
								{
									i++;
									matchCharCode = ( '00' + dv.getUint8( i - 1 ).toString( 16 ) ).slice( -2 );
									while ( i <= tagLength )
									{
										tagValue.push( '0x00' + matchCharCode );
										matchCharCode = ( '00' + dv.getUint8( i++ ).toString( 16 ) ).slice( -2 );
									}
								}

								// Substract last step increase, as next tag comes right after this one
								i--;
								metadata[ toGet[ tag ] ] = String.fromCharCode.apply( null, tagValue );
								delete toGet[ tag ];
								len = Object.keys( toGet ).length;
							}
						}
					} );
				}
				break;
			case 'ogg':
				mimeType = 'audio/ogg';

				// We need only these tags for now
				toGet = [
					'artist',
					'title',
					'album',
					'date'
				];
				len   = toGet.length;
				i     = 0;

				// Loop first 1000 bytes
				while ( i < 1000 && len )
				{
					charCode = dv.getUint8( i++ );

					for ( j = len; j--; )
					{
						tag     = toGet[ j ];
						tagCode = tag.charCodeAt( 0 );

						// Check for lower case match
						if ( charCode === tagCode )
						{
							match = true;
							// loop through all letters to make sure we have found a match
							for ( k = 1; k < tag.length; k++ )
							{
								matchCharCode = dv.getUint8( ( i - 1 ) + k );
								tagCode       = tag.charCodeAt( k );
								if ( matchCharCode !== tagCode )
								{
									match = false;
									break;
								}
							}

							// If a match is found get the tag
							if ( match )
							{
								// Byte before the 00 00 00 shows how many bytes the tag will be, including the
								// "artist=" part, so we read everything from "=" sign till the length is reachedl
								tagLength       = i - 1 + dv.getUint8( i - 5 );
								tagValue.length = 0;
								i               = i + tag.length;
								matchCharCode   = dv.getUint8( i++ );
								while ( i <= tagLength )
								{
									tagValue.push( matchCharCode );
									matchCharCode = dv.getUint8( i++ );
								}
								str = '';

								for ( k = 0; k < tagValue.length; k++ )
								{
									str += '%' + ( '0' + tagValue[ k ].toString( 16 ) ).slice( -2 );
								}

								metadata[ tag ] = decodeURIComponent( str );
								toGet.splice( j, 1 );
								len = toGet.length;
							}
							continue;
						}

						tagCode = tag.toUpperCase().charCodeAt( 0 );

						// Check for uppercase match
						if ( charCode === tagCode )
						{
							match = true;
							tag   = tag.toUpperCase();
							// loop through all letters to make sure we have found a match
							for ( k = 1; k < tag.length; k++ )
							{
								matchCharCode = dv.getUint8( ( i - 1 ) + k );
								tagCode       = tag.charCodeAt( k );
								if ( matchCharCode !== tagCode )
								{
									match = false;
									break;
								}
							}

							// If a match is found get the tag
							if ( match )
							{
								// Byte before the 00 00 00 shows how many bytes the tag will be, including the
								// "artist=" part, so we read everything from "=" sign till the length is reached
								tagLength       = i - 1 + dv.getUint8( i - 5 );
								tagValue.length = 0;
								i               = i + tag.length;
								matchCharCode   = dv.getUint8( i++ );
								while ( i <= tagLength )
								{
									tagValue.push( matchCharCode );
									matchCharCode = dv.getUint8( i++ );
								}
								str = '';

								for ( k = 0; k < tagValue.length; k++ )
								{
									str += '%' + ( '0' + tagValue[ k ].toString( 16 ) ).slice( -2 );
								}

								metadata[ tag.toLowerCase() ] = decodeURIComponent( str );
								toGet.splice( j, 1 );
								len = toGet.length;
							}
						}
					}
				}
				break;
			case 'm4a':
				mimeType = 'audio/mp4';
				toGet    = {
					'©art': 'artist',
					'©nam': 'title',
					'©alb': 'album',
					'©day': 'date'
				};
				len      = Object.keys( toGet ).length;
				i        = 50000;

				// Loop second 50000 bytes
				while ( i < 100000 && len )
				{
					charCode = dv.getUint8( i++ );

					for ( tag in toGet )
					{
						tagCode = tag.charCodeAt( 0 );

						// Check for lower case match
						if ( charCode === tagCode )
						{
							match = true;
							// loop through all letters to make sure we have found a match
							for ( k = 1; k < tag.length; k++ )
							{
								matchCharCode = dv.getUint8( ( i - 1 ) + k );
								tagCode       = tag.charCodeAt( k );
								if ( matchCharCode !== tagCode )
								{
									match = false;
									break;
								}
							}

							// If a match is found get the tag
							if ( match )
							{
								// Pattern: @nam 00 00 00 (byte showing length of tag, starting from next
								// byte) data 00 00 00 (byte showing I don't know what) 00 00 00 00 (text
								// for tag) 00 00 00 (byte showing I don't know what)
								i += 6;
								matchCharCode = dv.getUint8( i );
								tagLength     = i + matchCharCode;
								i += 13;
								matchCharCode = dv.getUint8( i );

								tagValue.length = 0;

								matchCharCode = dv.getUint8( i++ );
								while ( i <= tagLength && matchCharCode )
								{
									tagValue.push( matchCharCode );
									matchCharCode = dv.getUint8( i++ );
								}
								str = '';

								for ( k = 0; k < tagValue.length; k++ )
								{
									str += '%' + ( '0' + tagValue[ k ].toString( 16 ) ).slice( -2 );
								}

								metadata[ toGet[ tag ] ] = decodeURIComponent( str );
								delete toGet[ tag ];
								len = Object.keys( toGet ).length;

								continue;
							}
						}

						tagCode = tag.toUpperCase().charCodeAt( 0 );

						// Check for lower case match
						if ( charCode === tagCode )
						{
							match = true;
							tag   = tag.toUpperCase();
							// loop through all letters to make sure we have found a match
							for ( k = 1; k < tag.length; k++ )
							{
								matchCharCode = dv.getUint8( ( i - 1 ) + k );
								tagCode       = tag.charCodeAt( k );
								if ( matchCharCode !== tagCode )
								{
									match = false;
									break;
								}
							}

							// If a match is found get the tag
							if ( match )
							{
								// Pattern: @nam 00 00 00 (byte showing length of tag, starting from next
								// byte) data 00 00 00 (byte showing I don't know what) 00 00 00 00 (text
								// for tag) 00 00 00 (byte showing I don't know what)
								i += 6;
								matchCharCode = dv.getUint8( i );
								tagLength     = i + matchCharCode;
								i += 13;
								matchCharCode = dv.getUint8( i );

								tagValue.length = 0;

								matchCharCode = dv.getUint8( i++ );
								while ( i <= tagLength && matchCharCode )
								{
									tagValue.push( matchCharCode );
									matchCharCode = dv.getUint8( i++ );
								}
								str = '';

								for ( k = 0; k < tagValue.length; k++ )
								{
									str += '%' + ( '0' + tagValue[ k ].toString( 16 ) ).slice( -2 );
								}

								tag = tag.toLowerCase();

								metadata[ toGet[ tag ] ] = decodeURIComponent( str );
								delete toGet[ tag ];
								len = Object.keys( toGet ).length;
							}
						}
					}
				}
				break;
			case 'wav':
				mimeType = 'audio/wav';
				break;
		}

		return metadata;
	},

	/**
	 * Removes items from the playlist
	 */
	removeFromPlaylist()
	{
		let selectedRows = document.getElementById( n.activePlaylistId ).querySelectorAll( '.playlist-item.selected' );
		let len          = selectedRows.length;
		let confirm      = 0;

		for ( let i = len; i--; )
		{
			let row = selectedRows[ i ];
			if ( row.classList.contains( 'confirmation' ) )
			{
				confirm++;
			}
			else
			{
				row.classList.add( 'confirmation' );
			}
		}

		if ( len === confirm )
		{
			n.deleteItems();
		}
	},

	/**
	 * Remove item from playback's queue.
	 * @param {HTMLElement} [item] Optional. Item to be removed. If none passed, the selected one will be taken.
	 */
	removeFromQueue( item )
	{
		// Get item to be removed
		item = item && item.tagName ? item : n.currentlySelectedItem;

		// Get its index
		let idx = n.queue.indexOf( item );

		// Remove from queue if found in there
		if ( ~idx )
		{
			// Remove from queue array
			n.queue.splice( idx, 1 );

			// Remove queue number from users display
			item.querySelector( '.item-queue' ).innerHTML = '';

			// Remove queue mark from item if not queued again
			if ( !~n.queue.indexOf( item ) )
			{
				item.classList.remove( 'is-in-queue' );
			}

			// Update numbers of other queue items
			n.updateQueueStates();
		}
	},

	/**
	 * Re-renders all playlist items. Common use is when playlist item formatting is changed.
	 */
	refreshPlaylists()
	{
		// Select all items from both active and inactive playlists
		let items = document.getElementById( 'playlists' ).querySelectorAll( '.playlist-item' );

		// Re-render items
		for ( let i = items.length; i--; )
		{
			n.renderItem( items[ i ] );
		}

		// Return variable to false, so next time we won't refresh it again
		n.shouldRefreshPlaylist = false;
	},

	/**
	 * Re-renders status bar. Common use is when status bar formatting is changed.
	 */
	refreshStatusbar()
	{
		// Get item being played
		let item = document.getElementById( 'playlists' ).querySelector( 'div[data-icon="x"]' );

		// Status bar refresh will commence only if there is an item being played
		if ( item )
		{
			n.setFooter( item.parentNode.parentNode );
		}

		// Return variable to false, so next time we won't refresh it again
		n.shouldRefreshStatusBar = false;
	},

	/**
	 * Changes window title. Common use is when window title formatting is changed.
	 */
	refreshWindowTitle()
	{
		// Get item being played
		let item = document.getElementById( 'playlists' ).querySelector( 'div[data-icon="x"]' );

		// Window title change will commence only if there is an item being played
		if ( item )
		{
			n.setTitle( item.parentNode );
		}

		// Return variable to false, so next time we won't refresh it again
		n.shouldRefreshWindowTitle = false;
	},

	/**
	 * Rename playlist dialog window.
	 */
	renamePlaylist( title )
	{
		title                = title.tagName ? title : this.previousElementSibling;
		title.dataset.rename = true;
		title.className      = 'renaming';

		title.setAttribute( 'contenteditable', 'true' );

		document.body.addEventListener( 'click', n.playlistNameCheck );

		title.focus();

		n.changePlaylist( title.parentNode );

		//TODO: Check if Firefox is happy with this selectAll - as of Feb. 2014 they still have problems with selecting
		// all the contents of a contenteditable element
		document.execCommand( 'selectAll', false, null );
	},

	/**
	 * Render info to the sceen.
	 * @param {HTMLElement} item Required. Item to which the changes should appear.
	 */
	renderItem( item )
	{
		let durationContainer = item.querySelectorAll( '.item-duration' );
		let duration          = item.dataset.duration || '';

		// Create duration container if not already created and fill it
		if ( !durationContainer.length )
		{
			item.innerHTML += '<div class="float-right">'.concat( '<span class="item-duration">', duration, '</span>', '<div class="delete-icon" tabindex="-1" data-icon="m"></div></div>' );
		}
		// Otherwise just fill the already there duration element
		else
		{
			durationContainer[ 0 ].innerHTML = duration;
		}

		// Render formatted string if some info available
		item.querySelector( '.item-title' ).innerHTML = n.formatString( document.getElementById( 'preference-playlist-format' ).value, item );
	},

	/**
	 * Renders the table with keyboard shortcuts in preferences window.
	 */
	renderKeyboardShortcuts()
	{
		// Remove previous rows, if any
		let rows = document.getElementById( 'keyboard-shortcuts' ).querySelectorAll( '.va' );

		for ( let i = rows.length; i--; )
		{
			let row = rows[ i ];
			row.parentNode.removeChild( row );
		}

		// Find appending place
		let insertBefore = document.getElementById( 'actions' );
		const tagName    = 'tr';

		while ( tagName !== insertBefore.tagName.toLowerCase() )
		{
			insertBefore = insertBefore.parentNode;
		}

		// Render all keyboard shortcuts
		let df                = document.createDocumentFragment();
		const elementToCreate = 'tr';
		const id              = 'actions';
		const selectorStart   = 'option[value="';
		const selectorEnd     = '"]';
		const splitString     = '+';
		const joinString      = ' + ';

		n.pref.keys.forEach( key =>
		{
			let tr     = document.createElement( elementToCreate );
			let action = document.getElementById( id ).querySelector( selectorStart.concat( key.action, selectorEnd ) ).innerHTML;
			let keys   = key.key.split( splitString );

			keys.forEach( ( k, i ) =>
			{
				keys[ i ] = keyCodes[ keys[ i ] ];
			} );

			keys = keys.join( joinString );

			// Fill the row with needed atributes and HTML
			n._prepareShortcutRow( tr, key.key, key.action, keys, action );

			df.appendChild( tr );
		} );

		// Append the fragment to the DOM
		insertBefore.parentNode.insertBefore( df, insertBefore );
	},

	/**
	 * Restores Noisy to default preferences.
	 */
	restoreToDefaults()
	{
		let confirmation = document.getElementById( 'preferences-window-buttons' ).querySelectorAll( '.float-left' );

		if ( confirmation.length )
		{
			confirmation[ 0 ].classList.remove( 'confirmation' );
		}

		localStorage.removeItem( 'preferences' );

		n.pref.settings  = JSON.parse( JSON.stringify( n.pref.originalSettings ) );
		n.pref.firstTime = true;
		n.pref.process();

		n.changeScrobblingState( n.pref.settings.checkboxes[ 'preference-enable-scrobbling' ] );
		n.translate();
		n.initAnimations();
		n.checkConnections();
		n.applyTheme();
		n.checkQuota();
		n.initWelcome();
	},

	/**
	 * Saves curently active playlist. An internal call to savePlaylist() with active playlist id is made.
	 * @param {Boolean} [shouldReturn] Optional. If passed and true,
	 * constructed object will be returned, otherwise the playlist will be saved.
	 * @param {Boolean} [rename] Optional. If passed, playlist will change
	 * name of the active playlist, to the value that is read from the DOM.
	 *
	 * @return {Object} Object representing the playlist.
	 */
	saveActivePlaylist( shouldReturn, rename )
	{
		return n.savePlaylist( document.getElementById( n.activePlaylistId ), shouldReturn, rename );
	},

	/**
	 * Saves only one playlist.
	 *
	 * @param {HTMLElement} playlist Required. The playlist to be saved.
	 * @param {Boolean} [shouldReturn] Optional. If passed and true,
	 * constructed object will be returned, otherwise the playlist will be saved.
	 * @param {Boolean} [rename] Optional. If passed, playlist will change
	 * name of the active playlist, to the value that is read from the DOM.
	 *
	 * @return {Object} Object representing the playlist.
	 */
	savePlaylist( playlist, shouldReturn, rename )
	{
		// Object that will represent the playlist
		let obj = {};

		// Copy name
		obj.name = playlist.dataset.name;

		// Copy id
		obj.id = playlist.id;

		// Construct items
		obj.items = n.makePlaylistItems( obj.id );

		// Return object if it should
		if ( shouldReturn )
		{
			return obj;
		}

		// Otherwise save playlist

		// Load all playlists
		let playlists       = n.loadPlaylists();
		let notFound        = true;
		let foundPosition   = -1;
		const selectorStart = 'li[data-for="';
		const selectorEnd   = '"]';

		// Iterate all playlists
		for ( let i = playlists.length; i--; )
		{
			let playlist = playlists[ i ];
			let id       = playlist.id;

			// Replace found playlist with obj in case they are the same playlists
			if ( id === obj.id && !rename )
			{
				playlists[ i ] = obj;
				notFound       = false;
				break;
			}
			// Otherwise check if this is the old name of the playlist and remove it if it is
			else if ( rename && id === obj.id )
			{
				let tab  = document.querySelector( selectorStart.concat( id, selectorEnd ) );
				let plst = document.getElementById( id );

				tab.children[ 0 ].innerHTML =
					tab.dataset.name =
						plst.dataset.name =
							obj.name = plst.dataset.newname;

				tab.dataset.for =
					obj.id =
						plst.id = 'playlist-' + +new Date();

				foundPosition = i;

				break;
			}
		}

		// Save the new playlist if no old one found
		if ( notFound || rename )
		{
			if ( 0 > foundPosition )
			{
				playlists.unshift( obj );
			}
			else
			{
				playlists[ foundPosition ] = obj;
			}
		}

		// Save playlists
		localStorage.setItem( 'playlists', JSON.stringify( playlists ) );
	},

	/**
	 * Save all playlists in the localStorage.
	 */
	savePlaylists()
	{
		let toSave    = [];
		let playlists = document.querySelectorAll( '.playlists-tabs-li' );
		let playlist;
		const id      = 'add-playlist';

		// Iterate through all playlists and make objects for each of them
		for ( let i = playlists.length; i--; )
		{
			let playlist = playlists[ i ];

			if ( id !== playlist.id )
			{
				toSave.push( n.savePlaylist( document.getElementById( playlists[ i ].dataset.for ), true ) );
			}
		}

		// Save to localStorage as JSON string
		localStorage.setItem( 'playlists', JSON.stringify( toSave ) );

		// Do not save on click till next move
		n.movingShouldSave = false;
	},

	/**
	 * Saves currently active playlist to the cloud with the name user chosed in the files window.
	 */
	savePlaylistToCloud()
	{
		let src             = document.getElementById( 'add-window-files' );
		let val             = document.getElementById( 'save-playlist-window-filename' ).value.trim();
		let { path, cloud } = src.dataset;

		// To save we need valid (not empty) file name, path and cloud to which to save
		if ( val && path && cloud )
		{
			n.setFooter( n.lang.footer[ 'please-wait' ] );

			n[ cloud ].savePlaylist( val.concat( '.plst.nsy' ), path );
		}

		n.closeAll();
	},

	/**
	 * Delayed save of the preferences. Used when user makes multiple request for save in a 2 second interval - they
	 * are combined into one.
	 */
	saveActivePlaylistIdDelayed()
	{
		clearTimeout( n.saveTimeout );
		n.saveTimeout = setTimeout( () =>
		{
			n.pref.activePlaylistId = n.activePlaylistId;
		}, 1000 );
	},

	/**
	 * Saves preferences to the cloud with the name user chosed in the files window.
	 */
	savePreferencesToCloud()
	{
		let src             = document.getElementById( 'add-window-files' );
		let val             = document.getElementById( 'save-preferences-window-filename' ).value.trim();
		let { path, cloud } = src.dataset;

		// To save we need valid (not empty) file name, path and cloud to which to save
		if ( val && path && cloud )
		{
			n.setFooter( n.lang.footer[ 'please-wait' ] );

			n[ cloud ].savePreferences( val.concat( '.pref.nsy' ), path );
		}

		n.closeAll();
	},

	/**
	 * Switches from service icons window to files window and requests files for the chosen service.
	 * @param {String} service Required. Service which was chosen.
	 */
	selectService( service )
	{
		document.getElementById( 'add-window-cloud-chooser' ).hidden = true;
		document.getElementById( 'add-window-files' ).hidden         = false;
		document.querySelector( '.window' ).className                = 'window ' + service;

		n[ service ].getFolderContents( '' );
	},

	/**
	 * Set status bar's text.
	 *
	 * @param {*} [item] Optional. Item from which to get data. If not passed, selected one will be taken. Also string
	 *     can be passed for direct text print to the footer.
	 * @param {Boolean} [clear] Optional. If passed and true, status bar will be cleared before everything else.
	 */
	setFooter( item, clear )
	{
		let footerText = document.getElementById( 'footer-text' );

		if ( clear )
		{
			footerText.innerHTML = '';
			n.cancelAction       = true;
			document.getElementById( 'footer' ).classList.remove( 'cancel-action' );
		}
		else
		{
			if ( 'string' === typeof item )
			{
				footerText.innerHTML = item;
			}
			else
			{
				// Select selected item if no item is supplied
				if ( !item )
				{
					item = n.getItem( n.activePlaylistId );
				}

				// Set the status bar with the formated string
				footerText.innerHTML = n.formatString( document.getElementById( 'preference-status-bar-format' ).value, item );
			}
		}
	},

	/**
	 * Set state of current/selected item
	 * @param {String} [state] Optional. Class to add to the found item. Use without to make the player look like it's
	 *     not playing.
	 * @param {Boolean} [selected] Optional. Set class to the selected item instead of the found item. Used to when
	 *     play button is clicked for the first time and there is no other item currently playing.
	 * @param {HTMLElement} [item] Optional. Item to which the state should be set.
	 */
	setItemState( state, selected, item )
	{
		// Get currently active item or selected one on the currently active playlist
		item = item || document.querySelector( '.preloaded' ) || n.activeItem || n.currentlySelectedItem;

		item.classList.remove( 'preloaded' );

		// Get icon element in item
		item = item.querySelector( '.playback-status' );

		// Continue only if item found
		if ( item )
		{
			// State icons shouldn't repeat, so we should remove previous one
			let playbackStatus = document.getElementById( 'playlists' ).querySelector( '.playback-status[data-icon="'.concat( state, '"]' ) );

			if ( playbackStatus )
			{
				delete playbackStatus.dataset.icon;
			}

			// Remove playback state of current item
			delete item.dataset.icon;

			// Apply icon if passed. Item to apply depends on the selected argument
			if ( selected && 'string' === typeof state )
			{
				item                                                  = n.currentlySelectedItem;
				item.querySelector( '.playback-status' ).dataset.icon = state;
			}
			else if ( 'string' === typeof state )
			{
				item.dataset.icon = state;
			}
		}
	},

	/**
	 * Sets the progress of a progress bar.
	 *
	 * @param {HTMLElement} bar Required. Progress bar to which changes will apply.
	 * @param {Number} percents Required. Number between 0 and 100. Used to advance the progress bar.
	 */
	setProgress( bar, percents )
	{
		let oldPercents = parseInt( bar.children[ 0 ].style.width );

		// Update bar only if different (minimize redraw)
		if ( oldPercents !== percents )
		{
			// Change volume icon if the bar to set progress is volume bar
			if ( document.getElementById( 'volume' ) === bar && !n.audio.muted )
			{
				bar.parentNode.previousElementSibling.children[ 0 ].dataset.icon = Math.min( 4, Math.round( n.audio.volume / 0.25 ) + 1 );
			}

			// Set progress bar's progress
			bar.children[ 0 ].style.width = percents + '%';
		}
	},

	/**
	 * Set window title.
	 *
	 * @param {HTMLElement} [item] Optional. Item from which to get data. If not passed, selected one will be taken.
	 * @param {Boolean} [clear] Optional. If passed and true, window title will be reset to default before everything
	 *     else.
	 */
	setTitle( item, clear )
	{
		if ( clear )
		{
			document.title = n.lang.title;
		}
		else
		{
			// Select selected item if no item is supplied
			if ( !item )
			{
				item = n.getItem( n.activePlaylistId );
			}

			// Set the title of the window with the formated string
			document.title = n.formatString( document.getElementById( 'preference-window-title-format' ).value, item );
		}
	},

	/**
	 * Extracts the link for a YouTube video based on the social link clicked and shares it in the desired social media
	 * @param {HTMLElement} socialIcon Required. Social media icon on which the user clicked.
	 */
	shareYouTubeLink( socialIcon )
	{
		debugger;
	},

	//TODO: Combine all the show*() into one

	/**
	 * Shows about window.
	 */
	showAbout()
	{
		// Create window dialog
		n.window( 'about-window' );
	},

	/**
	 * Shows preferences window.
	 */
	showPreferences( e )
	{
		if ( e )
		{
			e.stopPropagation();
		}

		// Create window dialog
		n.window( 'preferences-window' );

		// Remove colors of the button (mark messages as read)
		let trigger = document.getElementById( 'header-right' ).lastElementChild;

		trigger.classList.remove( 'nb-error' );
		trigger.classList.remove( 'nb-warn' );

		// Scroll console to the bottom for the user to see most recent messages first
		n.console.scrollTop = n.console.offsetHeight;
	},

	/**
	 * Shows Add files/folders window.
	 */
	showAddFileFolder()
	{
		n.window( 'add-window' );
	},

	/**
	 * Shows Load playlist window.
	 */
	showLoadPlaylist()
	{
		n.window( 'load-playlist-window' );
		document.getElementById( 'add-window-files' ).dataset.filter = 'plst.nsy';
	},

	/**
	 * Shows Load preferences window.
	 */
	showLoadPreferences()
	{
		n.window( 'load-preferences-window' );
		document.getElementById( 'add-window-files' ).dataset.filter = 'pref.nsy';
	},

	/**
	 * Shows Save playlist window.
	 */
	showSavePlaylist()
	{
		n.window( 'save-playlist-window' );
	},

	/**
	 * Shows Save preferences window.
	 */
	showSavePreferences()
	{
		n.window( 'save-preferences-window' );
	},

	/**
	 * Shows find window.
	 */
	showSearch( e )
	{
		if ( e )
		{
			e.stopPropagation();
		}

		n.window( 'find-window' );

		// Focus input element after CSS3 animation is over
		setTimeout( () =>
		{
			document.getElementById( 'find-item' ).focus();
		}, 300 );
	},

	/**
	 * Shows welcome window.
	 */
	showWelcome()
	{
		n.window( 'welcome-window' );
	},

	/**
	 * Stop HTML Audio playback.
	 */
	stop()
	{
		if ( n.activeItem )
		{
			let idx        = parseInt( n.audio.dataset.item, 10 );
			let playlistId = n.audio.dataset.playlist;
			let item;

			if ( 'number' === typeof idx && !isNaN( idx ) )
			{
				item = document.getElementById( playlistId ).querySelectorAll( '.playlist-item' )[ idx ];
				item.classList.remove( 'bold' );
			}

			// Pause player
			n.audio.pause();

			// Remove file from HTML Audio
			n.lastfm.scrobble();
			n.audio.src = '';

			// Remove data attributes
			delete n.audio.dataset.item;
			delete n.audio.dataset.playlist;

			// Set player state to stop
			n.setItemState();

			// Update player's gauges
			n.updateMeters();

			// Reset window title and footer to default
			n.setTitle( null, true );
			n.setFooter( null, true );

			// Clear counter
			document.getElementById( 'footer-counter' ).innerHTML = '';
		}
	},

	/**
	 * Stops bubbling of an event.
	 * @param {Event} e Required. Event which should stop bubbling.
	 */
	stopBubbling( e )
	{
		e.stopPropagation();
	},

	/**
	 * Switches between normal and Dev channel
	 */
	switchChannel()
	{
		n.pref.devChannel = !n.pref.devChannel;
		location.href     = '//' + location.host + '/';
	},

	/**
	 * Toggles mute state of the player.
	 */
	toggleMute()
	{
		n.pref.muted = !n.audio.muted;
	},

	/**
	 * Translate Noisy to the language set in the preferences.
	 */
	translate()
	{
		// Internal function needed to construct HTML for FAQ answers.
		function _concatHTML( answer )
		{
			let compiled       = '';
			const stringString = 'string';
			const startOpen    = '<';
			const startClose   = '</';
			const end          = '>';
			const emptyString  = '';

			Object.keys( answer ).forEach( el =>
			{
				let val = answer[ el ];
				if ( stringString === typeof answer[ el ] )
				{
					compiled += startOpen.concat( el, end, val, startClose, el, end );
				}
				else
				{
					let isNan = isNaN( el );
					compiled += ( isNan ? startOpen.concat( el, end ) : emptyString );
					compiled += _concatHTML( val.adv || val );
					compiled += ( isNan ? startClose.concat( el, end ) : emptyString );
				}
			} );

			return compiled;
		}

		document.documentElement.lang = n.pref.lang;

		let splashItems = n.lang.splash;

		Object.keys( splashItems ).forEach( key =>
		{
			// When changing language the splash screen isn't present in the DOM, so we need fake object to set the
			// HTML to
			let splashNode       = document.getElementById( key ) || {};
			splashNode.innerHTML = splashItems[ key ];
		} );

		let menuItems = n.lang.menu;
		Object.keys( menuItems ).forEach( key =>
		{
			document.getElementById( key ).innerHTML = menuItems[ key ];
		} );

		let windowItems = n.lang.window;
		Object.keys( windowItems ).forEach( key =>
		{
			document.getElementById( key ).innerHTML = windowItems[ key ];
		} );

		let placeholderItems = n.lang.placeholders;
		Object.keys( placeholderItems ).forEach( key =>
		{
			document.getElementById( key ).placeholder = placeholderItems[ key ];
		} );

		let preferenceItems = n.lang.preferences;
		let id              = 'preferences-tabs';
		let selectorStart   = 'a[data-preference="';
		const selectorEnd   = '"]';
		Object.keys( preferenceItems ).forEach( key =>
		{
			document.getElementById( id ).querySelector( selectorStart.concat( key, selectorEnd ) ).innerHTML = preferenceItems[ key ];
		} );

		let actionItems = n.lang.actions;
		let secondId    = 'keyboard-shortcuts';
		const dotString = '.';

		id            = 'actions';
		selectorStart = 'option[value="';

		Object.keys( actionItems ).forEach( key =>
		{
			document.getElementById( id ).querySelector( selectorStart.concat( key, selectorEnd ) ).innerHTML = actionItems[ key ];

			let elements = document.getElementById( secondId ).querySelectorAll( dotString + key );

			for ( let i = elements.length; i--; )
			{
				elements[ i ].innerHTML = n.lang.actions[ key ];
			}
		} );

		let themeItems = n.lang.themes;
		id             = 'preference-theme';
		selectorStart  = 'option[value="';
		Object.keys( themeItems ).forEach( key =>
		{
			document.getElementById( id ).querySelector( selectorStart.concat( key, selectorEnd ) ).innerHTML = themeItems[ key ];
		} );

		let buttonItems = n.lang.buttons;
		Object.keys( buttonItems ).forEach( key =>
		{
			let items = document.querySelectorAll( '.' + key );

			for ( let i = items.length; i--; )
			{
				items[ i ].innerHTML = buttonItems[ key ];
			}
		} );

		let validationItems = n.lang.validation;
		Object.keys( validationItems ).forEach( key =>
		{
			let items = document.querySelectorAll( '.' + key );

			for ( let i = items.length; i--; )
			{
				items[ i ].innerHTML = validationItems[ key ];
			}
		} );

		let consoleItems = n.lang.console;
		Object.keys( consoleItems ).forEach( key =>
		{
			let items = document.querySelectorAll( '.' + key );

			for ( let i = items.length; i--; )
			{
				items[ i ].innerHTML = consoleItems[ key ];
			}
		} );

		let footerItems = n.lang.footer;
		Object.keys( footerItems ).forEach( key =>
		{
			let item = document.getElementById( key ) || {};

			item.innerHTML = footerItems[ key ];
		} );

		let helpItems = n.lang.help;
		Object.keys( helpItems ).forEach( key =>
		{
			document.getElementById( key ).title = helpItems[ key ];
		} );

		// Translate FAQ window
		let questions = n.lang.faq.q;
		id            = 'q-';
		secondId      = 'a-';

		questions.forEach( ( question, i ) =>
		{
			// Get corresponding answer for current question
			let answer   = n.lang.faq.a[ i ];
			let domIndex = i + 1;

			// Print the question to the screen
			document.getElementById( id + domIndex ).innerHTML = question;

			// Print the answer to the screen
			document.getElementById( secondId + domIndex ).innerHTML = _concatHTML( answer.adv || answer );
		} );

		// Add not supported text to all options which are not supported by the current browser
		let notSupported = document.querySelectorAll( '.not-supported' );
		for ( let i = notSupported.length; i--; )
		{
			notSupported[ i ].innerHTML += n.lang.other[ 'not-supported' ];
		}

		// Dropbox playlist convert text
		let playlistConvert = document.querySelectorAll( '.dropbox-convert-text' );
		for ( let i = playlistConvert.length; i--; )
		{
			playlistConvert[ i ].innerHTML += n.lang.other[ 'dropbox-playlist-convert' ];
		}

		let clickHereItems = document.querySelectorAll( '.click-here' );
		for ( let i = clickHereItems.length; i--; )
		{
			clickHereItems[ i ].innerHTML += n.lang.other[ 'click-here' ];
		}

		// Dev channel button
		let channelSwither = document.getElementById( 'channel-switcher' );
		if ( n.pref.devChannel )
		{
			channelSwither.innerHTML = n.lang.other[ 'button-channel-switcher-dev' ];
		}
		else
		{
			channelSwither.innerHTML = n.lang.other[ 'button-channel-switcher' ];
		}

		let notConnecteds = document.getElementById( 'add-window-cloud-chooser' ).querySelectorAll( 'a[data-notconnected]' );
		for ( let i = notConnecteds.length; i--; )
		{
			notConnecteds[ i ].dataset.notconnected = n.lang.other[ 'not-connected' ];
		}

		// Refresh window title
		n.setTitle( null, true );
		n.refreshWindowTitle();
	},

	/**
	 * Updates battery meter and sets Noisy in power save mode
	 */
	updateBatteryStatus()
	{
		let batteryContainer = document.getElementById( 'battery-level-menu-handle' );
		let levels           = document.querySelectorAll( '.battery-level' );
		let level            = n.battery.level;
		let level1;
		let level2;
		let level3;
		let lvl;
		let threshold        = parseInt( document.getElementById( 'power-saver-state' ).value, 10 ) / 100;

		for ( let i = levels.length; i--; )
		{
			lvl = levels[ i ];
			lvl.classList.remove( 'battery-level-green-full' );
			lvl.classList.remove( 'battery-level-green-half' );
			lvl.classList.remove( 'battery-level-orange-full' );
			lvl.classList.remove( 'battery-level-orange-half' );
			lvl.classList.remove( 'battery-level-red-full' );
			lvl.classList.remove( 'battery-level-red-half' );
		}

		if ( n.battery.level <= threshold && !n.battery.charging && n.pref.powerSaverEnabled )
		{
			if ( !n.powerSaveMode )
			{
				n.powerSaveMode = true;
				n.applyPowerSaveMode();
			}
		}
		else
		{
			if ( n.powerSaveMode )
			{
				n.powerSaveMode = false;
				n.applyPowerSaveMode();
			}
		}

		if ( !n.battery.charging && n.pref.powerSaverEnabled )
		{
			batteryContainer.classList.add( 'cap' );
			batteryContainer.setAttribute( 'title', Math.floor( n.battery.level * 100 ) + '%' );

			if ( 1 >= level && .83 <= level )
			{
				level1 = 'battery-level-green-full';
				level2 = 'battery-level-green-full';
				level3 = 'battery-level-green-full';
			}
			else if ( .82 >= level && .66 <= level )
			{
				level1 = 'battery-level-green-full';
				level2 = 'battery-level-green-full';
				level3 = 'battery-level-green-half';
			}
			else if ( .65 >= level && .50 <= level )
			{
				level1 = 'battery-level-orange-full';
				level2 = 'battery-level-orange-full';
			}
			else if ( .49 >= level && .33 <= level )
			{
				level1 = 'battery-level-orange-full';
				level2 = 'battery-level-orange-half';
			}
			else if ( .32 >= level && .16 <= level )
			{
				level1 = 'battery-level-red-full';
			}
			else
			{
				level1 = 'battery-level-red-half';
			}

			if ( level1 )
			{
				document.getElementById( 'battery-level-1' ).classList.add( level1 );
			}

			if ( level2 )
			{
				document.getElementById( 'battery-level-2' ).classList.add( level2 );
			}

			if ( level3 )
			{
				document.getElementById( 'battery-level-3' ).classList.add( level3 );
			}
		}
		else
		{
			batteryContainer.classList.remove( 'cap' );
			batteryContainer.removeAttribute( 'title' );
		}
	},

	/**
	 * Updates playback counter in the status bar.
	 * @param {Number} dur Required. Length of the item in seconds.
	 * @param {Number} pos Required. Position of the playback in seconds.
	 */
	updateCounter( dur, pos )
	{
		document.getElementById( 'footer-counter' ).innerHTML = pos.toString().toHHMMSS().concat( '/', dur.toString().toHHMMSS() );
	},

	/**
	 * Prints in the console that update has been downloaded and waiting for a refresh. Also marks Preferences icon
	 */
	updateFound()
	{
		n.console.innerHTML += '<div class="nb-update"><span class="update">'.concat( n.lang.console.update, '</span></div>' );
		document.getElementById( 'header-right' ).lastElementChild.classList.add( 'nb-update' );
	},

	/**
	 * Updates progress and volume meters on the GUI to be the same as HTML Audio.
	 */
	updateMeters()
	{
		if ( n.activeItem )
		{
			// If no duration, set to 1
			let dur      = n.audio.duration || 1;
			let pos      = n.audio.currentTime;
			let progress = Math.round( pos * 100 / dur );

			if ( 50 <= progress && !n.preloaded )
			{
				// Do not preload next time the updateMeters is called
				n.preloaded = true;

				let next = n.next( 'next', true );

				if ( next )
				{
					next.classList.add( 'preloaded' );
					n[ next.dataset.cloud ].preload( next );
				}
			}

			// Using animation frames to lower CPU usage when Noisy is not in focus
			requestAnimationFrame( () =>
			{
				n.setProgress( document.getElementById( 'progress' ), progress );

				if ( n.pref.counter )
				{
					n.updateCounter( dur, pos );
				}
			} );

			// Update meters, by a recurtion, if the progress bar is not full
			if ( !n.audio.paused )
			{
				setTimeout( n.updateMeters, 1000 );
			}
		}
		else
		{
			n.setProgress( document.getElementById( 'progress' ), 0 );
		}
	},

	/**
	 * Changes numbers infront of the items that shows which after which will be played.
	 */
	updateQueueStates()
	{
		n.queue.forEach( ( item, i, queue ) =>
		{
			// Get item's number container
			let q = item.querySelector( '.item-queue' );

			// Set item's number container with the new value if not
			//already set (in case of the same item added more than once
			//in the queue) and it's not being processed in the playback at the moment.
			if ( i === queue.indexOf( item ) && !item.querySelector( '.playback-status' ).dataset.icon )
			{
				q.innerHTML = i + 1;
			}
		} );
	},

	/**
	 * Method called from n.lastfm to update the counter shown to the user in the Performance section
	 */
	updateScrobbleCounter()
	{
		document.getElementById( 'preference-performance-scrobbling-tracks-to-scrobble' ).innerText = Object.keys( n.lastfm.queue.q ).length + '/50';
	},

	/**
	 * Updates the volume bar and icon depending on the volume level and mute state
	 */
	updateVolumeState()
	{
		// Set volume icon to muted if Noisy is muted
		if ( n.pref.settings.muted )
		{
			n.setProgress( document.getElementById( 'volume' ), 0 );
			document.getElementById( 'trigger-mute' ).dataset.icon = '0';
		}
		// Otherwise set the progress bar as it'll set the appropriate icon, too
		else
		{
			n.setProgress( document.getElementById( 'volume' ), n.pref.settings.volume * 100 );
		}
	},

	/**
	 * Turns up the volume by 10%
	 */
	volumeUp()
	{
		n.pref.volume = Math.min( 1, n.audio.volume + 0.1 );
	},

	/**
	 * Turns down the volume by 10%
	 */
	volumeDown()
	{
		n.pref.volume = Math.max( 0, n.audio.volume - 0.1 );
	},

	/**
	 * Get the item being loaded
	 * @returns {HTMLElement}
	 */
	get waitingItem()
	{
		let item = document.getElementById( 'playlists' ).querySelector( 'div[data-icon="w"]' );

		if ( item )
		{
			item = item.parentNode.parentNode;
		}

		return item;
	},

	/**
	 * Adds a warning line to the console.
	 * @param {String} section Required. Contains property name in the
	 * language object for the action we are logging.
	 * @param {String} data Required. Text to be printed in the console.
	 */
	warn( section, data = '' )
	{
		n.console.innerHTML += '<div class="nb-warn"><span class="'.concat( section, '">', n.lang.console[ section ], '</span>', data, '</div>' );
		document.getElementById( 'header-right' ).lastElementChild.classList.add( 'nb-warn' );
	},

	/**
	 * Shows window dialog.
	 * @param {String} cls Required. Class to be added to the window.
	 */
	window( cls )
	{
		// Get window element to which will apply classes
		let window = document.querySelector( '.window' );

		switch ( cls )
		{
			// These classes should be added to the window
			case 'exists':
			case 'invalid':
				window.classList.remove( 'exists' );
				window.classList.remove( 'invalid' );
				window.classList.add( cls );
				break;
			// All other classes are ids and should replace old id
			default:
				n.emptyAddWindow();
				window.id = cls;
		}
	}
};