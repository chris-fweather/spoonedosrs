import assert from 'node:assert/strict';
import test from 'node:test';
import {accountModeInfo,achievementTitleInfo,badgeLabel,emblemInfo,rankBadgeInfo,squireInfo,supporterTitleInfo} from './badge-info.ts';

test('an emblem card names how it was earned, its tier and the title it unlocks', () => {
 const info=emblemInfo({id:'pets-25',name:'25 pets',detail:'Collect 25 different pets',short:'25',img:'/brand/rocky-mascot.webp'},'the Pet Tamer');
 assert.deepEqual(info,{name:'25 pets',description:'Collect 25 different pets.',details:[['Tier','Gold'],['Title','the Pet Tamer']]});
 assert.equal(emblemInfo({id:'clog-1717',name:'Collection log complete',detail:'All 1,717 unique collection log items',short:'Full',img:''}).details[0][1],'Legendary');
});

test('a rank badge describes the badge shown, never a hidden role, and adds Sir', () => {
 const owner=rankBadgeInfo({role:'owner',prefix:'Sir',displayRole:null,displayPrefix:'Sir'});
 assert.equal(owner?.name,'Site Owner');
 assert.deepEqual(owner?.details,[['Rank','Owner'],['Name prefix','Sir']]);
 // Staff cards are the title, Rank and Name prefix only: no description sentence.
 assert.equal(owner?.description,'');
 assert.equal(badgeLabel(owner!),'Site Owner · Rank: Owner · Name prefix: Sir');
 // The owner showing a helper's scimitar reads as a helper.
 assert.equal(rankBadgeInfo({role:'owner',prefix:null,displayRole:'helper',displayPrefix:null})?.name,'Site Helper');
 assert.equal(rankBadgeInfo(null,{amountMinor:500,currency:'USD',hidden:false,supporter:true})?.details[0][1],'$5');
 assert.deepEqual(rankBadgeInfo(null,{amountMinor:500,currency:'USD',hidden:true,supporter:true})?.details,[]);
 assert.equal(rankBadgeInfo(null,{amountMinor:20000,currency:'USD',hidden:false,badge:'gilded',supporter:true})?.name,'Gilded supporter');
 assert.equal(rankBadgeInfo(null,undefined),null);
});

test('a staff hover card is headed by the custom job title, while Rank stays the real level', () => {
 assert.deepEqual(rankBadgeInfo({role:'admin',prefix:null,title:'Head Admin',displayPrefix:'Sir'}),{name:'Head Admin',description:'',details:[['Rank','Admin'],['Name prefix','Sir']]});
 assert.deepEqual(rankBadgeInfo({role:'helper',prefix:null,title:'Guide Lead'}),{name:'Guide Lead',description:'',details:[['Rank','Helper']]});
 // Unset falls back to the shown badge's name.
 assert.equal(rankBadgeInfo({role:'moderator',prefix:null,title:null})?.name,'Site Moderator');
 // A title belongs to the real rank: while the owner shows a helper's scimitar the card names that badge.
 assert.equal(rankBadgeInfo({role:'owner',prefix:null,title:'Founder',displayRole:'helper'})?.name,'Site Helper');
 // Donor badges keep their description.
 assert.equal(rankBadgeInfo({role:'admin',prefix:null,title:'Head Admin'},{amountMinor:20000,currency:'USD',hidden:false,badge:'gilded',supporter:true})?.description,'Donated $100 or more to Spooned OSRS.');
});

test('account modes, supporter and achievement titles explain themselves', () => {
 assert.equal(accountModeInfo('normal'),null);
 assert.equal(accountModeInfo('ultimate_ironman')?.name,'Ultimate Ironman');
 assert.deepEqual(supporterTitleInfo('the Generous',{amountMinor:2550,currency:'USD',hidden:false}).details,[['Donated','$25.50']]);
 assert.deepEqual(achievementTitleInfo('the Pet Tamer').details,[['Rarity','Rare']]);
 assert.equal(badgeLabel(achievementTitleInfo('the Pet Tamer')),'the Pet Tamer · Collect 25 pets. · Rarity: Rare');
});

test('a helper card names Squire, and a guide writer off the team gets a card on the word itself', () => {
 assert.deepEqual(rankBadgeInfo({role:'helper',prefix:null,displayPrefix:'Squire'})?.details,[['Rank','Helper'],['Name prefix','Squire']]);
 assert.deepEqual(squireInfo(null),{name:'Squire',description:'Wrote a published Spooned OSRS guide.',details:[]});
 assert.equal(squireInfo('helper').description,'Helper on the Spooned OSRS team.');
});
