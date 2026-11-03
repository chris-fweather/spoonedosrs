import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {IS_DEV_ENVIRONMENT} from './environment.ts';
import {PLUGIN_FEATURES,PLUGIN_ON_HUB,PLUGIN_PAGE,PLUGIN_PAGE_LIVE,pluginFeaturesShown,pluginNavLinks,pluginPageShown} from './plugin-page.ts';

test('the plugin page is on the production build, saying coming soon until the plugin is on the Plugin Hub',()=>{
 // Tests build like production: no SPOONED_ENV=dev.
 assert.equal(IS_DEV_ENVIRONMENT,false);
 assert.equal(PLUGIN_ON_HUB,false,'Flip PLUGIN_ON_HUB only once the plugin is approved on the Plugin Hub.');
 assert.equal(PLUGIN_PAGE_LIVE,true);
 assert.equal(PLUGIN_PAGE,true);
 assert.deepEqual(pluginNavLinks().map(l=>l.path),['plugin']);
 assert.equal(pluginPageShown(false,false,false),false);
});

test('the dev environment shows the plugin page, and approval shows it everywhere',()=>{
 assert.equal(pluginPageShown(true,false,false),true);
 assert.equal(pluginPageShown(false,true,false),true);
 assert.deepEqual(pluginNavLinks(true).map(l=>[l.path,l.label]),[['plugin','Plugin']]);
});

test('the header, the page route and the Connections link all follow the flag',()=>{
 assert.match(readFileSync('app/FeatureLinks.tsx','utf8'),/\.\.\.pluginNavLinks\(\)/);
 assert.doesNotMatch(readFileSync('app/FeatureLinks.tsx','utf8'),/path:'plugin'/);
 assert.match(readFileSync('app/plugin/page.tsx','utf8'),/if\(!PLUGIN_PAGE\)notFound\(\)/);
 assert.match(readFileSync('app/Connections.tsx','utf8'),/\{PLUGIN_PAGE && <a [^>]*href="\/plugin"/);
});

test('what needs the plugin itself (tokens, seen characters, verified badges) waits for the Plugin Hub on the live site',()=>{
 assert.equal(PLUGIN_FEATURES,false);
 assert.equal(pluginFeaturesShown(false,false),false);
 assert.equal(pluginFeaturesShown(true,false),true);
 assert.equal(pluginFeaturesShown(false,true),true);
 for(const f of ['app/AccountSettings.tsx','app/ProfileIdentity.tsx','lib/account-sections.ts','lib/verified-profile.ts'])assert.doesNotMatch(readFileSync(f,'utf8'),/\bPLUGIN_PAGE\b/,f);
});
