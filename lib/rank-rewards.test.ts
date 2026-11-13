import assert from 'node:assert/strict';
import test from 'node:test';
import {initial} from './model.ts';
import {rankTier,rankTitleRequirement,rankTitles} from './rank-rewards.ts';
import {selectedTitle,parsePresentation,editableTitleChoice} from './presentation.ts';
test('rank glows use inclusive thresholds and exclude unknown ranks',()=>{
 for(const [rank,tier] of [[1,'champion'],[10,'gold'],[11,'silver'],[100,'silver'],[101,'bronze'],[1000,'bronze'],[1001,null],[0,null],[-1,null],[1.5,null]] as const)assert.equal(rankTier(rank),tier);
});
test('one rank title per boss or skill, at the best tier held: Champion, Grandmaster, Expert, Elite',async()=>{
 const {titleRarity,titleEffect,achievementDescription}=await import('./presentation.ts');
 const j=structuredClone(initial);
 const at=(rank:number)=>{j.hiscores.activities=[{name:'Giant Mole',score:500,rank}];j.hiscores.skills=[];return rankTitles(j).map(t=>t.label);};
 assert.deepEqual(at(1),['the Giant Mole Champion']);assert.deepEqual(at(2),['the Giant Mole Grandmaster']);assert.deepEqual(at(10),['the Giant Mole Grandmaster']);
 assert.deepEqual(at(11),['the Giant Mole Grandmaster']);assert.deepEqual(at(45),['the Giant Mole Grandmaster']);assert.deepEqual(at(100),['the Giant Mole Grandmaster']);
 assert.deepEqual(at(101),['the Giant Mole Expert']);assert.deepEqual(at(500),['the Giant Mole Expert']);
 assert.deepEqual(at(501),['the Giant Mole Elite']);assert.deepEqual(at(1000),['the Giant Mole Elite']);assert.deepEqual(at(1001),[]);assert.deepEqual(at(-1),[]);
 assert.deepEqual(['Champion','Grandmaster','Expert','Elite'].map(n=>[titleRarity(`the Giant Mole ${n}`),titleEffect(`the Giant Mole ${n}`)]),
  [['legendary','title-legendary'],['epic','title-epic-glow'],['rare','title-rare'],['uncommon','title-uncommon']]);
 // No Master tier: a label that looks like one is an ordinary title, not a rank title.
 assert.equal(titleRarity('the Giant Mole Master'),'common');assert.equal(achievementDescription('the Giant Mole Master'),'the Giant Mole Master');
 assert.equal(achievementDescription('the Giant Mole Champion'),'Rank #1 in Giant Mole');
 assert.equal(achievementDescription('the Giant Mole Grandmaster'),'Rank #2–100 in Giant Mole');
 assert.equal(achievementDescription('the Giant Mole Elite'),'Rank #501–1,000 in Giant Mole');
 // A held rank title names the current rank, except Champion, whose tier is the rank.
 assert.equal(rankTitleRequirement('Grandmaster','Giant Mole'),'Rank #2–100 in Giant Mole','the range only, never the current rank');
 assert.equal(rankTitleRequirement('Master','Giant Mole'),null);
 assert.equal(rankTitleRequirement('Champion','Giant Mole'),'Rank #1 in Giant Mole');
 // Skills earn the same tiers; Overall does not.
 j.hiscores.activities=[];j.hiscores.skills=[{name:'Overall',level:2277,xp:1,rank:3},{name:'Agility',level:99,xp:1,rank:45}];
 assert.deepEqual(rankTitles(j).map(t=>t.label),['the Agility Grandmaster']);
});
test('rank titles follow synced rank, a saved choice follows the tier, and an owner cannot forge one',()=>{
 const j=structuredClone(initial);j.hiscores.activities=[{name:'Giant Mole',score:500,rank:900}];j.hiscores.skills=[];
 const elite=rankTitles(j)[0];assert.equal(elite.id,'hiscore:giant%20mole:elite');assert.equal(selectedTitle(j,elite.id,null),'the Giant Mole Elite');
 // Climbing to #45 keeps the saved choice and shows the new tier; an old Champion choice at #1 still works.
 j.hiscores.activities[0].rank=45;assert.equal(selectedTitle(j,elite.id,null),'the Giant Mole Grandmaster');
 j.hiscores.activities[0].rank=1;assert.equal(selectedTitle(j,'hiscore:giant%20mole:first',null),'the Giant Mole Champion');
 assert.equal(parsePresentation({titleChoice:elite.id},{staffBadge:null,staffPrefix:null,titleChoice:'none',showDonation:true} as never,j,null).titleChoice,'hiscore:giant%20mole:first');
 j.hiscores.activities[0].rank=1001;assert.equal(rankTitles(j).length,0);assert.equal(selectedTitle(j,elite.id,null,true),null);
 assert.throws(()=>parsePresentation({titleChoice:elite.id},{staffBadge:null,staffPrefix:null,titleChoice:'none',showDonation:true} as never,j,{role:'owner',prefix:null}));
});
test('a choice saved at the retired Master tier becomes the Grandmaster title, never an invalid choice',()=>{
 const j=structuredClone(initial);j.hiscores.activities=[{name:'Giant Mole',score:500,rank:45}];j.hiscores.skills=[];
 const saved='hiscore:giant%20mole:master',prior={staffBadge:null,staffPrefix:null,titleChoice:saved,showDonation:true} as never;
 assert.equal(selectedTitle(j,saved,null),'the Giant Mole Grandmaster');
 assert.equal(editableTitleChoice(j,saved,null),'hiscore:giant%20mole:grandmaster');
 assert.equal(parsePresentation({},prior,j,null).titleChoice,'hiscore:giant%20mole:grandmaster');
 // It follows the rank like any saved rank title, and reads as Grandmaster even when the rank is not synced yet.
 j.hiscores.activities[0].rank=300;assert.equal(selectedTitle(j,saved,null),'the Giant Mole Expert');
 j.hiscores.activities=[];assert.equal(editableTitleChoice(j,saved,null),'hiscore:giant%20mole:grandmaster');assert.equal(selectedTitle(j,saved,null),null);
});
