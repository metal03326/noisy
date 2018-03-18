/**
 * Noisy URL module for managing all the ObjectURLs for cloud storages
 *
 * @author metal03326
 * @version 201170507
 */

// URL Manager singleton to be passed to Noisy
let urlManager = {
	// Collect all the ObjectUrls here in the format cloudURL: ObjectUrl
	urls: {
		// Take note which after which came, so we can later remove the oldest first. Array should be full with
		// cloudURLs, not ObjectUrls
		order: []
	},

	// What's the maximum amount of ObjectUrls to store. This will limit memory usage
	maxUrlCount: 10,

	/**
	 *
	 * @param {String} url Required. CloudUrl with which UrlManager will search for existing ObjectUrl
	 * @returns {*} Either string containing the ObjectUrl for this cloudUrl or undefined, if UlrManager
	 *     doesn't know anything about that cloudUrl
	 */
	get( url )
	{
		return this.urls[ url ];
	},

	/**
	 * Adds a set of cloudUrl and ObjectUrl to the UrlManger, overwritting an existing pair
	 * @param {String} url Required. CloudUrl to be set in the cloudUrl: ObjectUrl pair
	 * @param {String} objectUrl Required. ObjectUrl to be set in the cloudUrl: ObjectUrl pair
	 */
	add( url, objectUrl )
	{
		this.urls[ url ] = objectUrl;
		this.urls.order.push( url );

		// Check if we have reached the limit
		this.removeExcess();
	},

	/**
	 * Removes cloudUrl from the stack
	 * @param {String} url Required. CloudUrl which have to be removed
	 */
	remove( url )
	{
		// Free memory
		URL.revokeObjectURL( this.urls[ url ] );

		// Remove it from the stack
		delete this.urls[ url ];
	},

	/**
	 * Checks if we have reached the limit and removes the oldest entries if we have
	 */
	removeExcess()
	{
		// Remove all but last items if we are in power saving mode
		if ( n.pref.powerSaver )
		{
			while ( this.urls.order.length > 1 )
			{
				this.remove( this.urls.order.shift() );
			}
		}
		// Otherwise remove only the excess items
		else
		{
			while ( this.urls.order.length > this.maxUrlCount )
			{
				this.remove( this.urls.order.shift() );
			}
		}
	}
};