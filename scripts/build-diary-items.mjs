// Rebuilds lib/diary-requirement-items.json: each diary requirement line that names items becomes one tile per item
// (with its quantity), alternatives ("X or Y") share a tile, "Any axe" gets a typical icon, hand-checked lines become
// skill or quest tiles, and the rest stays as short plain notes. Lines not listed are read by the panel itself.
// Run: node scripts/build-diary-items.mjs. Re-runnable: it reads the item ids already chosen for each line.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const OUT='lib/diary-requirement-items.json';
const current=read(OUT);
const names={...read('lib/item-names.json'),...read('lib/guide-item-catalogue.json')};
for(const [name,id] of Object.entries(read('lib/quest-item-ids.json')))names[id]??=name;
// Icons we have whose names the catalogues lack.
Object.assign(names,{2415:'Saradomin staff',9813:'Quest point cape',12658:"Iban's staff (u)",10498:"Ava's attractor",5527:'Air tiara',5529:'Mind tiara',5531:'Water tiara',5535:'Earth tiara',5537:'Fire tiara',5539:'Cosmic tiara',5541:'Nature tiara',5543:'Chaos tiara'});
/** Runecrafting altars: talisman and tiara. */
const ALTARS={Air:[1438,5527],Mind:[1448,5529],Water:[1444,5531],Earth:[1440,5535],Fire:[1442,5537],Cosmic:[1454,5539],Nature:[1462,5541],Chaos:[1452,5543]};
const hasIcon=id=>fs.existsSync(`public/items/${id}.png`);
/** OSRS item names start with a capital letter. */
export const itemName=name=>{if(!name)throw Error("Unnamed item");return name.charAt(0).toUpperCase()+name.slice(1);};
const norm=s=>s.toLowerCase().replaceAll('’',"'").replace(/\s+/g,' ').trim();
const forms=name=>{const n=norm(name);return new Set([n,n+'s',n+'es',n.replace(/s$/,''),n.replace(/es$/,''),n.replace(/ies$/,'y'),n.replace(/ves$/,'f'),n.replace(/y$/,'ies'),n.replace(/f$/,'ves')]);};
// Every item with an icon, by every singular/plural spelling; the lowest id wins unless a line already chose one.
const index=new Map();
for(const [id,name] of Object.entries(names).sort((a,b)=>Number(a[0])-Number(b[0]))){if(!hasIcon(id))continue;for(const f of forms(name))if(!index.has(f))index.set(f,Number(id));}
/** Hand-checked tiles for lines the splitter cannot read: prose, "X or Y staff" and the like. */
const I=(id,quantity,note)=>({items:[{id,name:itemName(names[id])}],...(quantity>1?{quantity}:{}),...(note?{note}:{})});
const A=(ids,note)=>({items:ids.map(id=>({id,name:itemName(names[id])})),...(note?{note}:{})});
const T=text=>({text});
/** A skill or quest tile; noCheck when an alternative ("or a Slayer cape") may stand in, so no tick or cross. */
const S=(skill,level,note,noCheck)=>({skill,level,...(note?{note}:{}),...(noCheck?{noCheck:true}:{})});
const Q=(quest,note,stage,noCheck)=>({quest,...(note?{note}:{}),...(stage?{stage}:{}),...(noCheck?{noCheck:true}:{})});
/** "Any axe": one tile with a typical item's icon. */
const ANY_ICON={axe:1351,'woodcutting axe':1351,pickaxe:1265,crossbow:837,'light source':4548,logs:1511,'grimy herb':199,machete:975,bones:526,gloves:1059,'fruit tree sapling':5496,bow:843,'tannable hide':1739,'team cape':20211,'blamish shell':3345,'god staff':2415,'void helm':11665,'cape of accomplishment':9780};
const ANY=(what,note)=>{const id=ANY_ICON[what.toLowerCase()];if(!id)throw Error('No icon for any '+what);return {items:[{id,name:itemName(names[id])}],label:'Any '+what,...(note?{note}:{})};};
const OVERRIDES={
 'Dramen or Lunar staff to travel to Fairy ring code .':[A([772,9084],'for the fairy ring')],
 'Dramen or Lunar staff to travel to Fairy ring code':[A([772,9084],'for the fairy ring')],
 'Dramen or Lunar staff recommended to travel to Fairy ring code for quick access to the city':[A([772,9084],'recommended, for the fairy ring')],
 'Mith grapple and any crossbow':[I(9419),T('Any crossbow')],
 'If the route has not been unlocked yet, 11 total yew logs are required to unlock it before flying again to Castle Wars to complete this task. Upon unlocking the route, you may use 1 normal log to depart to Taverley before returning to Castle Wars for the task completion.':[T('First time: 11 yew logs to unlock the route'),T('Then fly to Taverley (1 log) and back')],
 "Iban's upgraded staff, or 200,000 coins and Iban's staff to have the Dark Mage in West Ardougne upgrade it":[I(12658),T("Or Iban's staff and 200,000 coins for the Dark Mage")],
 'Less than fully charged skills necklace or combat bracelet':[A([11113,11126],'not fully charged')],
 'Salve amulet(i) or Salve amulet(ei), or 800,000 Nightmare Zone points points to imbue the normal one (reduced to 400,000 points with the hard tier of the combatachievement Combat Achievements completed)':[A([12017,12018]),T('Or imbue a Salve amulet for 800,000 NMZ points')],
 'Means to cast Ice Barrage ( or a Blighted ancient ice sack for every cast)':[T('Means to cast Ice Barrage'),I(24607,1,'or one per cast')],
 'Antipoison and food recommended if not bringing your own potato cactus':[I(2446,1,'recommended'),T('Food recommended, unless you bring a potato cactus')],
 'Note: Crafting runes using Guardian essence will NOT complete this achievement':[T('Guardian essence does not count'),],
 'It is not possible to skip having to complete Skippy and the Mogres, or needing a fishing explosive, by killing them through a boat cannon through the Sailing skill.':[I(6660),T('A boat cannon does not skip Skippy and the Mogres')],
 'Any Cape of Accomplishment (except for joke skillcapes or the Max cape)':[ANY('Cape of Accomplishment','not the Max cape')],
 'Waterbirth teleport tablet to directly access the island, or either 1000 coins or quest completion of The Fremennik Trials to travel via Jarvald':[I(24953,1,'or sail with Jarvald'),T('Jarvald: 1,000 coins until The Fremennik Trials')],
 'Way of getting past the two-man doors at the dungeon entrance (help from another player, pet rock and rune thrownaxes, or Agility 85 for the rock shortcut)':[I(3695,1,'with rune thrownaxes'),T('Or another player, or 85 Agility for the shortcut')],
 'Way of getting past the two-player doors at the dungeon entrance (help from another player, pet rock and rune thrownaxes, or Agility 85 for the rock shortcut)':[I(3695,1,'with rune thrownaxes'),T('Or another player, or 85 Agility for the shortcut')],
 'Slayer helmet (requires Crafting 55 ) (and Quest completion of Cabin Fever for Ironman accounts)':[I(11864,1,'55 Crafting to make')],
 'Glarial\'s amulet only if Waterfall Quest isn\'t yet completed':[T("Glarial's amulet, until Waterfall Quest is complete")],
 'Combat bracelet recommended for quick access from the nearby Ranging Guild':[I(11126,1,'recommended')],
 '5,000 coins (an additional 5,000 coins if your randomised family crest already is Saradomin, to change to another and back)':[I(995,5000),T('5,000 more coins if your crest is already Saradomin')],
 'Additional 15,000 coins to construct a Skill Hall if you haven\'t already':[T('Skill Hall not built yet: 15,000 more coins')],
 '25,000 coins for an estate agent to move your house to Yanille':[I(995,25000,'to move your house')],
 '30,000 coins, 4 oak planks, saw, and hammer to construct a menagerie with a pet house, if you haven\'t already':[T('Menagerie not built yet: 30k coins, 4 oak planks')],
 'Kq head or Kq head (tattered), and 50,000 coins to have the taxidermist stuff it':[A([7981,22671]),I(995,50000,'for the taxidermist')],
 '200 coins (or 205 coins if using the Shantay Pass)':[I(995,200),T('5 more coins if you use the Shantay Pass')],
 '200 coins and a Shantay Pass or another 5 coins.':[I(995,200),I(1854,1,'or 5 more coins')],
 'Bronze spear, watermelon, and a hay sack (you can fill an empty sack with hay at the hay bale in the chicken coop nearby.)':[I(1237),I(5982),I(6057,1,'fill an empty sack at the hay bale')],
 'Rake, pickaxe, axe, harpoon and/or lobster pot, depending on how you plan to gain support':[I(5341),T('Any pickaxe'),T('Any axe'),A([311,301],'depending on how you gain support')],
 'Any pickaxe and a brown apron, golden apron, or Crafting cape':[T('Any pickaxe'),A([1757,20208,9780])],
 'Keris or Keris partisan, and any light source':[A([10581,25979]),T('Any light source')],
 'Prospector helmet or golden prospector helmet':[A([12013,25549])],
 '100 trading sticks and having helped in Tai Bwo Wannai Cleanup (if using the Hardwood Grove)':[T('Hardwood Grove: 100 trading sticks, Cleanup helped')],
 'Harpoon (or barehanded fishing), lobster pot, small fishing net, or a fishing rod with bait, depending on the spot you fish at':[A([311,301,303,307],'depending on the spot')],
 'Cooked oomlie wrap, or the requirements to make it (Cooking 50 , a palm leaf, and a raw oomlie)':[I(2343,1,'or 50 Cooking to make one')],
 'Barbarian rod and suitable bait (fishing bait, feathers, fish offcuts, roe, or caviar)':[I(11323),{...A([313,314,11334,11324,11326]),label:'Any bait'}],
 'Scroll of redirection and a house tablet':[I(11740),I(8013)],
 'Boots of stone, brimstone, or granite':[A([23037,21643],'or brimstone boots')],
 'Face mask, gas mask, or slayer helmet':[A([1506,11864],'or a face mask')],
 'Hammer, 3 regular planks, and about 50 nails of any variant':[I(2347),I(960,3),{...I(1539,50,'about 50, any kind'),label:'Nails'}],
 'Knife and a hammer or Imcando hammer recommended to score more points':[I(946),A([2347,25644],'Imcando hammer scores more')],
 'Earmuffs or Slayer helmet recommended':[A([4166,11864],'recommended')],
 'Magic or Redwood pyre logs, any shade remains, and a tinderbox':[A([3448,19672]),T('Any shade remains'),I(590)],
 'Ogre bellows, (comp) ogre bow, and ogre or brutal arrows':[I(2871),A([2883,4827]),I(2866,1,'or brutal arrows')],
 'Void knight top, robe, and gloves':[I(8839),I(8840),I(8842)],
 'Gold bar, cut diamond, amulet mould, ball of wool':[I(2357),I(1601),I(1595),I(1759)],
 'Tinderbox and a regular bullseye lantern':[I(590),I(4548)],
 'Harralander potion (unf) and goat horn dust':[I(97),I(9736)],
 'Fly fishing rod and some feathers (bring enough feathers to account for fishing raw salmon multiple times before you get a raw trout)':[I(309),I(314,1,'bring plenty')],
 'Bread dough, multiple recommended in case of burning one (always successful at Cooking 34)':[I(2307,1,'bring spares below 34 Cooking')],
 '875 coins (unless you have unlocked permanently free access via either Saniboch or Banisoch)':[I(995,875),T('Free with permanent access from Saniboch or Banisoch')],
 'Crystal-mine key recommended (allows use of veins on Level 2, right next to the secret entrance)':[I(29788,1,'recommended')],
 'Ghostspeak amulet and 25 ecto-tokens (or 10 with the Ring of Charos(a))':[I(552),T('25 ecto-tokens, or 10 with a Ring of charos(a)')],
 'Steel bar and ammo mould (or 2 steel bars and double ammo mould)':[I(2353),I(4,1,'or a double ammo mould and 2 bars')],
 'Restore potion, garlic, and silver dust (made by using a silver bar on the Ectofuntus bone grinder)':[I(2430),I(1550),I(7650,1,'grind a silver bar at the Ectofuntus')],
 'Logs, obtainable from a dying tree here with any axe for another easy task':[I(1511,1,'from the dying tree here')],
 '100 coins recommended, to have the Sawmill operator turn the logs from the tree into a plank for another easy task':[I(995,100,'recommended, for a plank')],
 'Gnomebowl mould, Gianne dough, 4 chocolate bars, an equa leaf, 2 pots of cream, and chocolate dust (can all be purchased at Grand Tree Groceries)':[I(2166),I(2171),I(1973,4),I(2128),I(2130,2),I(1975)],
 'One set of normal logs, oak logs, yew logs, or magic logs, depending on the chosen destination':[A([1511,1521,1515,1513],'one set, by destination')],
 'Knife, Wilderness sword 1, or a slashing weapon (Or with Agility 82 using the Stepping Stone shortcut North of the Lava Maze)':[A([946,13108],'or any slash weapon, or 82 Agility')],
 'Knife, Wilderness sword 1 or 2, or a slashing weapon':[A([946,13108],'or any slash weapon')],
 'Chef\'s hat, golden chef\'s hat, Varrock armour 3, or Cooking cape':[{...A([1949,20205,13106,9801]),label:"Chef's hat or alternative"}],
 '2 dashing kebbit fur (requires Hunter 69 if playing as Ironman)':[I(10127,2,'69 Hunter for Ironmen')],
 'Witchwood icon and a light source (if Fire of Eternal Light has not been built) recommended':[I(8923),ANY('light source','until the Fire of Eternal Light is built')],
 'Any axe (can be found north of the Rellekka mine) and a tinderbox':[T('Any axe'),I(590)],
 'Any pickaxe (can be found north of the Rellekka mine) and a tiara mould':[T('Any pickaxe'),I(5523)],
 'Seaweed (can be found near Jiminua\'s Jungle Store)':[I(401)],
 'Any axe, bow string (can be spun from flax), and a knife':[T('Any axe'),I(1777),I(946)],
 'Creating the digsite pendant for the first time requires Magic 49, the clean necklace, and means to cast Lvl-3 Enchant ( )':[T('First pendant only: clean necklace and Lvl-3 Enchant')],
 '100,000 coins, 2 limestone bricks, 3 teak planks, hammer, and saw to construct a portal chamber with an activatable teak portal and teleport focus, if you haven\'t already':[T('Portal chamber not built yet: 100,000 coins'),T('Portal and focus: 3 teak planks, 2 limestone bricks')],
 'Knife or a slash weapon, and an empty waterskin':[I(946,1,'or a slash weapon'),I(1831)],
 'Weaponry, and a spade to enter the Brine Rat Cavern':[T('Weaponry'),I(952,1,'to enter the Brine Rat Cavern')],
 '95,000 coins to purchase the granite body':[I(995,95000,'for the granite body')],
 'Additional 5,000 coins if already using Fancy Stone, to change to something else and back':[T('5,000 more coins if you already have Fancy Stone')],
 '30 coins or a Ring of Charos(a)':[I(995,30,'or a Ring of charos(a)')],
 'Ship ticket or 20-50 coins (the price is random)':[I(621,1,'or 20–50 coins')],
 "Machete or Agility 79, and having started Quest Legends' Quest (if using the Kharazi Jungle)":[T("Kharazi: machete or 79 Agility, and Legends' started")],
 'Combat 100 and Slayer 50, or a Slayer cape':[S('Combat',100,'or a Slayer cape',true),S('Slayer',50,'or a Slayer cape',true)],
 "8,750 coins for an estate agent to move your house to Hosidius (can only be done after you've visited Great Kourend)":[I(995,8750,'to move your house')],
 'King worms (found on the island) or fish offcuts':[A([2162,11334])],
 "Xeric's talisman charged with a lizardman fang, or a mounted xeric's talisman inside any player-owned house (see the House party worlds)":[I(13393,1,'or a mounted one in any house')],
 '8 potato cacti recommended to protect your sapling':[I(3138,8,'recommended')],
 "Rope if the caves haven't been entered yet":[T('Rope, the first time you enter the caves')],
 'None, though a lockpick is recommended':[I(1523,1,'recommended')],
 "75 steel arrows with Ava's attractor, or 75 steel arrows with 999 coins":[T('75 steel arrows'),I(10498,1,'or 999 coins')],
 'Dramen or Lunar staff to enter Zanaris':[A([772,9084],'to enter Zanaris')],
 'Dramen or Lunar staff to enter Zanaris, or access to the Abyss':[A([772,9084],'or the Abyss')],
 'Dramen or Lunar staff recommended to travel to Fairy ring code':[A([772,9084],'recommended, for the fairy ring')],
 'Binding necklace recommended to guarantee the runes are successfully crafted':[I(5521,1,'recommended')],
 'Any tannable hide and 2-45 coins depending on the type of hide':[ANY('tannable hide'),I(995,45,'2–45, by hide')],
 'Slayer helmet or nose peg recommended against the aberrant spectres, when climbing the spikey chain on the as a shortcut to the advanced spikey chain':[A([11864,4168],'recommended, for aberrant spectres')],
 'Wear a Ring of Charos(a)':[I(6465,1,'worn')],
 'If the starting point in Varrock has not been unlocked yet, an additional 10 willow logs are needed to first fly towards it from Entrana':[T('First time: fly Entrana to Varrock (10 willow logs)')],
 '25,000 coins to construct a Quest Hall if you haven\'t already':[T('Quest Hall not built yet: 25,000 coins')],
};
/** Lines outside the item list: requirements that read as skill, quest or item tiles, and short notes. [] drops a line
 * (links to Wiki strategy pages, a heading for the lines under it). */
const GARDENER='recommended, to pay the gardener';
const ESSENCE={...A([7936,1436]),label:'Essence',note:'pure, daeyalt or rune'};
const BARROWS=(skills,set)=>skills.map(skill=>S(skill,70,set+', not boostable',true));
const MORE={
 'Basket of apples recommended to pay the nearby farmer to protect the crop':[T('Basket of apples recommended, to pay the farmer')],
 'Completion of The Hand in the Sand (unless playing as Ultimate Ironman)':[Q('The Hand in the Sand','not for Ultimate Ironmen')],
 '15 Papaya fruit recommended to pay the gardener':[I(5972,15,GARDENER)],
 '15 papaya fruit recommended to pay the gardener':[I(5972,15,GARDENER)],
 '15 papayas recommended to pay the gardener':[I(5972,15,GARDENER)],
 '8 poison ivy berries recommended to pay the gardener':[I(6018,8,GARDENER)],
 '10 cactus spines recommended to pay the gardener':[I(6016,10,GARDENER)],
 'Pure or daeyalt essence':[I(7936,1,'or daeyalt essence')],
 'Pure, daeyalt, or rune essence':[ESSENCE],
 '28 pure, daeyalt, or rune essence (less may suffice at higher Runecraft levels)':[{...ESSENCE,quantity:28},T('Fewer may do at higher Runecraft levels')],
 '28 pure, daeyalt, or rune essence (fewer may suffice with more Raiments of the Eye pieces)':[{...ESSENCE,quantity:28},T('Fewer may do with more Raiments of the Eye pieces')],
 '28 pure or daeyalt essence (this task is not bypass-able with Raiments of the Eye)':[I(7936,28,'or daeyalt'),T('Raiments of the Eye do not lower this one')],
 '28 pure or daeyalt essence (less may suffice with Raiments of the Eye pieces)':[I(7936,28,'or daeyalt'),T('Fewer may do with Raiments of the Eye pieces')],
 'Earth talisman, earth runes, and pure or daeyalt essence':[I(1440),I(557),I(7936,1,'or daeyalt essence')],
 'Raw manta ray, multiple recommended in case of burning one':[I(389,1,'bring spares')],
 'Raw karambwan, multiple recommended in case of burning one':[I(3142,1,'bring spares')],
 'Ultracompost recommended':[I(21483,1,'recommended')],
 'Antipoison recommended':[I(2446,1,'recommended')],
 "Necklace of passage recommended for quick access to Eagle's Eyrie, near the Uzer Hunter area":[T("Necklace of passage recommended, to Eagle's Eyrie")],
 "Necklace of passage recommended for quick access to Eagle's Eyrie, near the Uzer mine":[T("Necklace of passage recommended, to Eagle's Eyrie")],
 "Players must have started Icthlarin's Little Helper for access to Sophanem.":[Q("Icthlarin's Little Helper",'started','started')],
 'Any artefact from Pyramid Plunder.':[{...A([9028]),label:'Any Pyramid Plunder artefact'}],
 'Protection against desert heat recommended':[T('Desert heat protection recommended')],
 "Waterskin that isn't full and means to cast Humidify ( )":[{...I(1831,1,'not full'),label:'Waterskin'},T('Means to cast Humidify')],
 'None, though using Magic or a Ranged weapon is recommended':[T('Magic or Ranged recommended')],
 'Crystal key':[I(989)],'Muddy key':[I(991)],'Box trap':[I(10008)],'Thin snail':[I(3363)],'Dark totem':[I(19685)],'Raw wild pie':[I(7206)],'Raw summer pie':[I(7216)],
 'Quest point cape':[I(9813)],
 'Farming 23 (Ironman accounts require Farming 47 or the ability to kill gryphons)':[S('Farming',23),S('Farming',47,'Ironman only, or kill gryphons',true)],
 'Initiate armour':[{...A([9668]),label:'Initiate armour'}],
 'Full Proselyte armour':[{...A([9666]),label:'Proselyte armour',note:'full set'}],
 'Crafting 36 (and Farming 30 for Ironman accounts)':[S('Crafting',36),S('Farming',30,'Ironman only')],
 '6 Willow branches':[I(5933,6)],
 'Runecraft 42 with 3+ Raiments of the Eye pieces':[S('Runecraft',42,'with 3+ Raiments of the Eye pieces')],
 'Runecraft 77 with 2 Raiments of the Eye pieces or 1 Raiments of the Eye piece and abyssal lantern (with willow, magic, or redwood logs)':[S('Runecraft',77,'with 2 Raiments of the Eye pieces'),T('Or 1 piece and a willow, magic or redwood lantern')],
 'Runecraft 66 with 3 Raiments of the Eye pieces':[S('Runecraft',66,'with 3 Raiments of the Eye pieces')],
 'Runecraft 55 with 4 Raiments of the Eye pieces':[S('Runecraft',55,'with 4 Raiments of the Eye pieces')],
 'Runecraft 57 with 3 Raiments of the Eye pieces, (2 pieces with Abyssal lantern lit with magic logs)':[S('Runecraft',57,'with 3 Raiments of the Eye pieces'),T('Or 2 pieces and a lantern lit with magic logs')],
 'Runecraft 38 with 4 Raiments of the Eye pieces (random chance, not guaranteed)':[S('Runecraft',38,'with 4 Raiments pieces, by chance')],
 'Runecraft 52 with 2+ Raiments of the Eye (1 piece with Abyssal lantern lit with magic logs)':[S('Runecraft',52,'with 2+ Raiments of the Eye pieces'),T('Or 1 piece and a lantern lit with magic logs')],
 "Protection from the wyvern's icy breath and weaponry to slay it":[T('Weaponry and protection from icy breath')],
 'Protection from dragonfire and weaponry to slay it':[T('Weaponry and dragonfire protection')],
 'Protection from dragonfire recommended':[T('Dragonfire protection recommended')],
 'Protection from dragonfire recommended if not safe spotting and weaponry to slay it':[T('Weaponry'),T('Dragonfire protection, unless you safespot')],
 'Weaponry and protection from dragonfire':[T('Weaponry and dragonfire protection')],
 'Any axe, protection from dragonfire, and weaponry':[ANY('axe'),T('Weaponry and dragonfire protection')],
 'Any axe and weaponry':[ANY('axe'),T('Weaponry')],
 'Combat gear and a light source':[ANY('light source'),T('Combat gear')],
 'Rank of White Knight Master (requires a Black Knight kill score of 1300 - this rank automatically starts at White Knight Novice, with a kill score of 100)':[T('White Knight Master rank (1,300 Black Knight kills)')],
 'Toadflax potion (unf), crushed nest':[I(3002),I(6693)],
 "Partial completion of the Troll Stronghold, or completion of the Easy Combat Achievements for Ghommal's hilt 1":[Q('Troll Stronghold',"partial, or Ghommal's hilt 1",'partial',true)],
 "Partial completion of the Troll Stronghold, or completion of the combatachievement Easy Combat Achievements for Ghommal's hilt 1":[Q('Troll Stronghold',"partial, or Ghommal's hilt 1",'partial',true)],
 "Partial completion of Troll Stronghold, or completion of the combatachievement Easy Combat Achievements for Ghommal's hilt 1":[Q('Troll Stronghold',"partial, or Ghommal's hilt 1",'partial',true)],
 'Any pickaxe (can be found north of the Rellekka mine)':[ANY('pickaxe','one lies north of the Rellekka mine')],
 'Completion of The Fremennik Trials and having started Fairytale II - Cure a Queen':[Q('The Fremennik Trials'),Q('Fairytale II - Cure a Queen','started','started')],
 'Hunter 35 with a butterfly net and jar':[S('Hunter',35),I(10010),I(10012)],
 'Food and Prayer 43 for protection prayers recommended':[S('Prayer',43,'recommended, for protection prayers'),T('Food recommended')],
 'Agility 70, Strength 70, Hitpoints 70, and Ranged 70 (only Hitpoints is boostable)':[S('Agility',70,'not boostable'),S('Strength',70,'not boostable'),S('Hitpoints',70,'boostable'),S('Ranged',70,'not boostable')],
 'Prayer 70 and Defence 70 (neither boostable)':[S('Prayer',70,'not boostable'),S('Defence',70,'not boostable')],
 'Fishing 96 and Strength 76 (both are boostable)':[S('Fishing',96,'boostable'),S('Strength',76,'boostable')],
 'Completion of the Barbarian Assault tutorial to be able to play the minigame':[T('Barbarian Assault tutorial done')],
 "Completion of King's Ransom and the Knight Waves Training Grounds":[Q("King's Ransom"),T('Knight Waves Training Grounds done')],
 "Completion of Nature Spirit and the Knight Waves Training Grounds (which requires completion of King's Ransom)":[Q('Nature Spirit'),Q("King's Ransom"),T('Knight Waves Training Grounds done')],
 'This can also be completed by travelling to Port Sarim from The Pandemonium via Seaman Morris.':[T('Or sail from The Pandemonium with Seaman Morris')],
 'You need to speak to Sharimika and go through the dialogue options and you must have picked up some trading sticks from a villager as reward before the dialogue options will show up for this diary step.':[T('Earn trading sticks from a villager before Sharimika')],
 'Enough coins to pay the fare for a charter ship.':[T('Coins for a charter ship')],
 'Completion of Jungle Potion, and either completion of Shilo Village or items for Tai Bwo Wannai Cleanup':[Q('Jungle Potion'),Q('Shilo Village','or items for Tai Bwo Wannai Cleanup',undefined,true)],
 'Weaponry, optionally':[T('Weaponry, optional')],
 'Completion of Tai Bwo Wannai Trio (speak to Tinsay after the quest)':[Q('Tai Bwo Wannai Trio','then speak to Tinsay')],
 'The quest can be started without all the required skills, but reaching this area requires Agility 50, Thieving 50, Mining 52, and Strength 50 (all boostable).':[S('Agility',50,'boostable'),S('Thieving',50,'boostable'),S('Mining',52,'boostable'),S('Strength',50,'boostable')],
 "Antidote++ and 5-20 Zulrah's scales (5 per dose)":[I(5952),I(12934,20,'5–20, 5 per dose')],
 'Completion of The Depths of Despair, The Queen of Thieves, Tale of the Righteous, The Forsaken Tower and The Ascent of Arceuus':['The Depths of Despair','The Queen of Thieves','Tale of the Righteous','The Forsaken Tower','The Ascent of Arceuus'].map(q=>Q(q)),
 "Rejuvenation potions recommended for learners (these are made in the minigame's lobby)":[T('Rejuvenation potions recommended, made in the lobby')],
 'Games necklace recommended for quick access':[T('Games necklace recommended')],
 "Slayer ring recommended for quick access to Tarn's Lair":[T("Slayer ring recommended, to Tarn's Lair")],
 'Completion of Another Slice of H.A.M.':[Q('Another Slice of H.A.M.')],
 '2 Ecto-tokens or quest completion of Ghosts Ahoy to walk into Port Phasmatys, or enough coins for a charter ship.':[T('Into Port Phasmatys: 2 ecto-tokens or Ghosts Ahoy'),T('Or coins for a charter ship')],
 'Weaponry to fight at range, or means to negate disease (such as Slayer gloves), recommended':[T('Ranged weapons, or Slayer gloves against disease')],
 '200 law runes and 100 blood runes to direct a portal to Kharyrll, or 2000 law runes and 1000 blood runes if adding the portal to a portal nexus instead':[I(563,200),I(565,100),T('A portal nexus takes 2,000 law and 1,000 blood runes')],
 'Only a successful climb (not taking damage) will count as task completed.':[T('Only a climb without taking damage counts')],
 'If you are boosting with the Dragon harpoon special attack, you need to bank the harpoon before catching the shark. Having it in the inventory will use it by default and it will not count as barehanded.':[T('If boosting with a dragon harpoon, bank it first')],
 'Various other skill requirements depending on the set used, none of which can be boosted:':[],
 "Attack 70 and Magic 70 for Ahrim's":BARROWS(['Attack','Magic'],"Ahrim's"),
 "Attack 70 and Strength 70 for Dharok's or Torag's":BARROWS(['Attack','Strength'],"Dharok's or Torag's"),
 "Attack 70 for Guthan's or Verac's":BARROWS(['Attack'],"Guthan's or Verac's"),
 "Ranged 70 for Karil's":BARROWS(['Ranged'],"Karil's"),
 "Completion of Gertrude's Cat and partial completion of Garden of Tranquillity":[Q("Gertrude's Cat"),Q('Garden of Tranquillity','partial','partial')],
 'Food, protection prayers, and/or enough hitpoints to run through all four floors of the stronghold':[T('Food or protection prayers for all four floors')],
 'Digsite pendant, or a mounted digsite pendant inside any player-owned house (see the House party worlds)':[T('Digsite pendant, or a mounted one in any house')],
 'Super attack (4), super strength (4), super defence (4), and a torstol':[I(2436),I(2440),I(2442),I(269)],
 'Completion of The Grand Tree and partial completion of One Small Favour':[Q('The Grand Tree'),Q('One Small Favour','partial','partial')],
 'Completion of the Gnome Restaurant tutorial':[T('Gnome Restaurant tutorial done')],
 'Cooking 29 (varies per food)':[S('Cooking',29,'varies by food')],
 'Ninja monkey greegree or Kruk monkey greegree (other greegrees will cause you to fail the course)':[T('Ninja or Kruk monkey greegree (others fail)')],
 'Isafdar painting (bought from Sir Renitee for 2,000 coins)':[I(995,2000,'for the Isafdar painting')],
 'Completion of the Awowogei subquest of Recipe for Disaster':[Q('Recipe for Disaster','Awowogei subquest','partial')],
 'Combat 40, Prayer 22, Attack 42, Strength 42, Defence 42, Hitpoints 42, Ranged 42, and Magic 42':[S('Combat',40),S('Prayer',22),...['Attack','Strength','Defence','Hitpoints','Ranged','Magic'].map(skill=>S(skill,42))],
 'Any void helm (melee, ranger, or mage helm)':[ANY('void helm')],
 'Item that can be alchemised (nearly any item)':[T('Any item that can be alchemised')],
 '130 combined levels in Attack and Strength, or level 99 in either':[T('130 Attack plus Strength, or 99 in either')],
 'Have no weapons or armour equipped or in your inventory':[T('No weapons or armour, worn or carried')],
 'Access to Bones to Peaches via the Mage Training Arena':[T('Bones to Peaches from the Mage Training Arena')],
 'Agility 60 or Strength 60':[S('Agility',60,'or 60 Strength',true)],
 'Agility 60 or Strength 60, and Slayer 50':[S('Agility',60,'or 60 Strength',true),S('Slayer',50)],
 'Agility 60 or Strength 60, and Slayer 68':[S('Agility',60,'or 60 Strength',true),S('Slayer',68)],
 'Agility 60 or Strength 60, and Slayer 83':[S('Agility',60,'or 60 Strength',true),S('Slayer',83)],
 'Weaponry, or sufficient combat stats to defeat a level 86 or level 98 Ankou while unarmed':[T('Weaponry, or the stats to kill an Ankou unarmed')],
 'Any god staff and means to cast its related god spell ( per cast)':[ANY('god staff'),T('Means to cast its god spell')],
 'Completion of the Medium Wilderness diary is required to kill the greater versions, and completion of the Hard Wilderness diary is required to kill the lesser versions':[T('Medium Wilderness diary for the greater bosses'),T('Hard Wilderness diary for the lesser bosses')],
 'Gout tuber, as well one of the following:':[I(6311),T('Only one gem set is needed')],
 '300 trading sticks and 3 cut or uncut opals':[I(1625,3,'or cut; 300 trading sticks')],
 '600 trading sticks and 3 cut or uncut jades':[I(1627,3,'or cut; 600 trading sticks')],
 '1200 trading sticks and 3 cut or uncut red topaz':[I(1629,3,'or cut; 1,200 trading sticks')],
 'Maple logs, and any bow (except the twisted, cursed, dark, crystal, ogre, rain, starter or signed oak bow)':[I(1517),ANY('bow','not twisted, crystal, ogre and a few others')],
 'Stamina potion (2) and caviar':[I(12629),I(11326)],
 'Any axe and machete, or Agility 79 for the vine shortcut':[ANY('axe'),I(975),T('Or 79 Agility for the vine shortcut')],
 'Skull sceptre, or the required items to create it':[I(9013,1,'or the items to make one')],
 'See the strategy guide':[],'See the recommendations':[],'See the gameplay overview and the strategy guide':[],'See Kudos for all activities that grant them':[],'See the strategy guide for the TzHaar Fight Cave':[],
 "See the boss overview (or see the individual strategy guides for Kree'arra, General Graardor, Commander Zilyana, and K'ril Tsutsaroth)":[],
 'See the individual strategy guides for the Crazy archaeologist, Chaos Fanatic, and Scorpia':[],
 "See the individual strategy guides for Callisto, Venenatis, and Vet'ion, or those for the weaker bosses Artio, Spindel, and Calvar'ion":[],
};
for(const [line,tiles] of Object.entries(MORE)){if(OVERRIDES[line])throw Error('Listed twice: '+line);OVERRIDES[line]=tiles;}
/** Split a line at top-level commas and "and" (never inside brackets or numbers like 1,920). */
const top=s=>{const out=[];let depth=0,cur='',orList=false;for(let i=0;i<s.length;i++){const c=s[i];if(c==='(')depth++;if(c===')')depth=Math.max(0,depth-1);
 const m=depth===0&&s.slice(i).match(/^(,\s+(?:and\/or\s+|and\s+|or\s+)?|\s+and\/or\s+|\s+and\s+)/);
 if(m){if(/^,\s+or\s/.test(m[1]))orList=true;out.push(cur);cur='';i+=m[1].length-1;continue;}cur+=c;}out.push(cur);return {parts:out.map(p=>p.trim()).filter(Boolean),orList};};
function lookup(core,preferred){const n=norm(core);for(const id of preferred)if(forms(names[id]??'').has(n))return id;return index.get(n)??null;}
function part(raw,preferred){
 let p=raw.replace(/\(\s*\)/g,'').replace(/[.]$/,'').trim();const notes=[];
 p=p.replace(/^wear an?\s+/i,'').replace(/^(?:a set of|an empty|a regular|another|some|the|an?)\s+/i,'');
 const q=p.match(/^(\d[\d,]*)(?:[-–](\d[\d,]*))?\s+(?:total\s+)?(.+)$/);let quantity=1;
 if(q){quantity=Number((q[2]??q[1]).replaceAll(',',''));if(q[2])notes.push(`${q[1]}–${q[2]}`);p=q[3];}
 const tile=ids=>({items:ids.map(id=>({id,name:itemName(names[id])})),...(quantity>1&&ids.length===1?{quantity}:{}),...(notes.length?{note:notes.join(', ')}:{})});
 const whole=lookup(p,preferred);if(whole)return tile([whole]);
 const paren=p.match(/^(.*?)\s*\((.+)\)\s*$/);if(paren){p=paren[1];notes.push(paren[2].trim());const id=lookup(p,preferred);if(id)return tile([id]);}
 // "recommended", "to enter …", "if …": the item first, the rest as a note.
 const tail=p.match(/^(.*?)\s+((?:recommended|optional|to|for|if|when|depending|with)\b.*)$/i);
 if(tail){const id=lookup(tail[1],preferred);if(id){notes.unshift(tail[2]);return tile([id]);}}
 const alts=p.split(/\s+or\s+/i),found=[];
 for(const alt of alts){const id=lookup(alt.replace(/^(?:an?|the)\s+/i,''),preferred);if(id)found.push(id);else notes.push('or '+alt);}
 return found.length&&alts.length>1?tile(found):null;
}
const ids=rows=>(Array.isArray(rows)?rows:[]).flatMap(r=>r.items?r.items.map(i=>i.id):r.id?[r.id]:[]);
const capital=s=>s.charAt(0).toUpperCase()+s.slice(1);
// Every requirement line of every task, keyed as the panel looks it up (lib/adventure-requirements.ts).
const LINES=[...new Set(Object.values(read('lib/diary-tasks.json').areas).flatMap(area=>area.tiers.flatMap(tier=>tier.tasks.flatMap(task=>task.requirements.split('\n'))))
 .map(raw=>raw.replace(/[ \t]{2,}/g,' ').replace(/(\d+)\s+(st|nd|rd|th)\b/gi,'$1$2').replace(/^\*+\s*/,'').trim().replace(/^Quest\s+(?!point\b)/,'')).filter(Boolean))];
/** "Any axe" and "light source" notes become item tiles with a typical icon. */
const anyTile=tile=>{
 if(!('text' in tile))return tile;
 const m=tile.text.match(/^(Any\s+)?(.+?)(?:\s+\((.+)\))?[.]?$/i),what=m[2].toLowerCase();
 return (m[1]||what==='light source')&&ANY_ICON[what]?ANY(what,m[3]):tile;
};
const result={},unread=[];
for(const line of LINES){
 if(OVERRIDES[line]){result[line]=OVERRIDES[line];continue;}
 const altar=line.match(/^Access to the (\w+) Altar \(.*\)$/);
 if(altar&&ALTARS[altar[1]]){result[line]=[A(ALTARS[altar[1]],/Abyss/.test(line)?'or the Abyss':'')];continue;}
 const rows=current[line],any=anyTile(T(line));
 if(!('text' in any)){result[line]=[any];continue;}
 const preferred=ids(rows),split=top(line),parts=split.parts.map(raw=>({raw,tile:part(raw,preferred)}));
 if(!parts.some(p=>p.tile)){if(rows)unread.push(line);continue;}
 // A line not listed before joins only when every part is an item; the rest the panel reads as skills, quests or notes.
 if(!rows&&!parts.every(p=>p.tile))continue;
 // "A, B, or C": one tile of alternatives.
 if(split.orList&&parts.every(p=>p.tile)){result[line]=[A(parts.flatMap(p=>p.tile.items.map(i=>i.id)))];continue;}
 result[line]=parts.map(p=>p.tile??T(capital(p.raw.replace(/^(?:an?|the)\s+/i,'').replace(/[.]$/,'').trim())));
}
for(const line of Object.keys(result))result[line]=result[line].map(anyTile);
for(const line of Object.keys(OVERRIDES))if(!LINES.includes(line))throw Error('Override for a line no task has: '+line);
const QUESTS=new Set(Object.keys(read('lib/quest-reference.json').quests));
const SKILLS=new Set(['Combat','Attack','Strength','Defence','Ranged','Prayer','Magic','Runecraft','Construction','Hitpoints','Agility','Herblore','Thieving','Crafting','Fletching','Slayer','Hunter','Mining','Smithing','Fishing','Cooking','Firemaking','Woodcutting','Farming','Sailing']);
for(const [line,tiles] of Object.entries(result))for(const t of tiles){
 if(t.quest&&!QUESTS.has(t.quest))throw Error(`Unknown quest "${t.quest}" in ${line}`);
 if(t.skill&&!SKILLS.has(t.skill))throw Error(`Unknown skill "${t.skill}" in ${line}`);
}
for(const tiles of Object.values(result))for(const t of tiles)for(const i of t.items??[])if(!hasIcon(i.id))throw Error('No icon for '+i.id);
// One requirement line per row keeps diffs readable.
fs.writeFileSync(OUT,'{\n'+Object.entries(result).map(([k,v])=>JSON.stringify(k)+':'+JSON.stringify(v)).join(',\n')+'\n}\n');
console.log(`Wrote ${Object.keys(result).length} diary item lines.`+(unread.length?` Unread (dropped): ${unread.map(l=>JSON.stringify(l)).join(', ')}`:''));
