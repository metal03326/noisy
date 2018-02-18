const fs         = require( 'fs-extra' );
const minifier   = require( 'html-minifier' );
const CleanCSS   = require( 'clean-css' );
const UglifyJS   = require( 'uglify-es' );
const jsonminify = require( 'jsonminify' );

let foldersToClean          = [ './docs/' ];
let filesToCopyInProduction = [
	{ from: 'browserconfig.xml', to: './docs/browserconfig.xml' },
	{ from: 'CNAME', to: './docs/CNAME' },
	{ from: 'sitemap.xml', to: './docs/sitemap.xml' },
	{ from: 'robots.txt', to: './docs/robots.txt' },
	{ from: 'google9638db4c20f16281.html', to: './docs/google9638db4c20f16281.html' },
	{ from: './src/img/', to: './docs/img/' },
	{ from: './src/fonts/', to: './docs/fonts/' },
	{ from: './src/js/', to: './docs/js/' },
	{ from: './src/css/', to: './docs/css/' },
	{ from: './docs/img/open_graph.png', to: './docs/open_graph.png', method: 'moveSync' },
	{ from: './docs/img/favicon.ico', to: './docs/favicon.ico', method: 'moveSync' }
];

foldersToClean.forEach( fs.emptyDirSync );

filesToCopyInProduction.forEach( file =>
{
	let method = file.method || 'copySync';
	let from   = file.from || ('./src/' + file);
	let to     = file.to || ('./docs/' + file);

	console.log( method, from, 'to docs folder' );
	fs[ method ]( from, to );
} );

console.log( 'Minifying index.html and saving it to docs' );
fs.writeFileSync( './docs/index.html', minifier.minify( fs.readFileSync( './src/index.html', 'utf8' ), {
	removeComments               : true,
	removeCommentsFromCDATA      : true,
	removeCDATASectionsFromCDATA : true,
	collapseWhitespace           : true,
	collapseBooleanAttributes    : true,
	removeAttributeQuotes        : true,
	removeRedundantAttributes    : true,
	useShortDoctype              : true,
	removeEmptyAttributes        : true,
	removeOptionalTags           : true,
	minifyJS                     : text => UglifyJS.minify( text ).code,
	minifyCSS                    : true,
	decodeEntities               : true,
	removeScriptTypeAttributes   : true,
	removeStyleLinkTypeAttributes: true
} ) );

console.log( 'Minifying css files' );
const cssDir = './docs/css/';
fs.readdir( cssDir, ( err, filenames ) => filenames.forEach( filename => fs.writeFileSync( `${cssDir}${filename}`, new CleanCSS( {level: 2} ).minify( fs.readFileSync( `${cssDir}${filename}`, 'utf8' ) ).styles ) ) );

console.log( 'Minifying js and json files' );
(function minifiyJS( dir = './docs/js' )
{
	fs.readdir( dir, ( err, filenames ) => filenames.forEach( filename =>
	{
		const name = `${dir}/${filename}`;

		if ( fs.statSync( name ).isDirectory() )
		{
			minifiyJS( name );
		}
		else if ( name.endsWith( '.json' ) )
		{
			fs.writeFileSync( name, jsonminify( fs.readFileSync( name, 'utf8' ) ) );
		}
		else
		{
			fs.writeFileSync( name, UglifyJS.minify( fs.readFileSync( name, 'utf8' ) ).code );
		}
	} ) );
})();