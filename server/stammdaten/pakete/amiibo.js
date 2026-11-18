// amiibo (Nintendo): Figuren und Karten, je Reihe eine Unterserie. Nur Fakten (Name, Nummer, Jahr der ersten Welle).
// Nummern nur, wo die Packung eine trägt (z. B. Super Smash Bros., Animal-Crossing-Karten); bei doppelter Nummer
// (Gold-Edition, Steve/Alex, Pyra/Mythra) bekommt die zweite Figur keine. Angekündigte, noch nicht erschienene Figuren
// fehlen bewusst (Stand 13.10.2026) und werden nach Erscheinen ergänzt.
export default {
  name: 'amiibo',
  serie: { name: 'amiibo', hersteller: 'Nintendo', merch_kategorie: 'spielfigur', mit_farben: false, liste: '' },
  unterserien: [
    {
      name: "Animal Crossing", jahr: 2015,
      liste: `
; Isabelle - Winter Outfit
; K.K.
; Mabel
; Tom Nook
; Digby
; Reese
; Cyrus
; Lottie
; Blathers
; Celeste
; Resetti
; Kicks
; Timmy & Tommy
; Kapp'n
; Rover
; Isabelle - Summer Outfit`,
    },
    {
      name: "BOXBOY!", jahr: 2017,
      liste: `
; Qbby`,
    },
    {
      name: "Chibi-Robo!", jahr: 2015,
      liste: `
; Chibi-Robo`,
    },
    {
      name: "Dark Souls", jahr: 2018,
      liste: `
; Solaire of Astora`,
    },
    {
      name: "Diablo", jahr: 2018,
      liste: `
; Loot Goblin`,
    },
    {
      name: "Donkey Kong", jahr: 2025,
      liste: `
; Donkey Kong & Pauline`,
    },
    {
      name: "Fire Emblem", jahr: 2017,
      liste: `
; Alm
; Celica
; Chrom
; Tiki`,
    },
    {
      name: "Kirby", jahr: 2016,
      liste: `
; Kirby
; Meta Knight
; King Dedede
; Waddle Dee`,
    },
    {
      name: "Kirby Air Riders", jahr: 2025,
      liste: `
; Kirby & Warp Star
; Bandana Waddle Dee & Winged Star
; Meta Knight & Shadow Star
; King Dedede & Tank Star
; Chef Kawasaki & Hop Star`,
    },
    {
      name: "Mega Man", jahr: 2018,
      liste: `
; Mega Man`,
    },
    {
      name: "Metroid", jahr: 2017,
      liste: `
; Samus Aran (Metroid: Samus Returns)
; Metroid
; Samus (Metroid Dread)
; E.M.M.I.
; Samus (Metroid Prime 4)
; Samus & Vi-O-La
; Sylux`,
    },
    {
      name: "Monster Hunter Rise", jahr: 2021,
      liste: `
; Magnamalo
; Palamute
; Palico
; Malzeno
; “Canyne Malzeno” Palamute
; “Felyne Malzeno” Palico`,
    },
    {
      name: "Monster Hunter Stories", jahr: 2016,
      liste: `
; One-Eyed Rathalos and Rider - Girl
; One-Eyed Rathalos and Rider - Boy
; Navirou
; Rathian and Cheval
; Barioth and Ayuria
; Qurupeco and Dan
; Ena
; Razewing Ratha
; Tsukino
; Ratha
; Ratha V
; Rudy`,
    },
    {
      name: "My Mario Wood Blocks", jahr: 2025,
      liste: `
; Mario
; Luigi
; Peach
; Yoshi`,
    },
    {
      name: "Pikmin", jahr: 2017,
      liste: `
; Pikmin`,
    },
    {
      name: "Pragmata", jahr: 2026,
      liste: `
; Diana`,
    },
    {
      name: "Resident Evil", jahr: 2026,
      liste: `
; Grace Ashcroft
; Leon S. Kennedy`,
    },
    {
      name: "Shovel Knight", jahr: 2015,
      liste: `
; Shovel Knight
; Plague Knight
; Specter Knight
; King Knight
; Shovel Knight - Gold Edition`,
    },
    {
      name: "Skylanders SuperChargers", jahr: 2015,
      liste: `
; Hammer Slam Bowser
; Turbo Charge Donkey Kong
; Dark Hammer Slam Bowser
; Dark Turbo Charge Donkey Kong`,
    },
    {
      name: "Splatoon", jahr: 2015,
      liste: `
; Inkling Girl
; Inkling Boy
; Inkling Squid
; Callie
; Marie
; Inkling Girl (Lime Green)
; Inkling Boy (Purple)
; Inkling Squid (Orange)
; Inkling Girl (Neon Pink)
; Inkling Boy (Neon Green)
; Inkling Squid (Neon Purple)
; Pearl
; Marina
; Octoling Girl
; Octoling Boy
; Octoling Octopus
; Inkling (Yellow)
; Octoling (Blue)
; Smallfry
; Shiver
; Frye
; Big Man
; Callie (Alterna)
; Marie (Alterna)
; Pearl (Side Order)
; Marina (Side Order)
; Shiver (Splatoon Raiders)
; Frye (Splatoon Raiders)
; Big Man (Splatoon Raiders)`,
    },
    {
      name: "Street Fighter", jahr: 2025,
      liste: `
; Luke
; Jamie
; Kimberly`,
    },
    {
      name: "Super Mario", jahr: 2015,
      liste: `
; Mario
; Luigi
; Peach
; Yoshi
; Toad
; Bowser
; Mario - Gold Edition
; Mario - Silver Edition
; Wario
; Rosalina
; Boo
; Donkey Kong
; Waluigi
; Daisy
; Diddy Kong
; Goomba
; Koopa Troopa
; Mario - Wedding Outfit
; Peach - Wedding Outfit
; Bowser - Wedding Outfit
; Cat Mario
; Cat Peach
; Elephant Mario
; Poplin & Prince Florian
; Captain Toad & Talking Flower
; Mario and Luma
; Rosalina and Lumas`,
    },
    {
      name: "Super Mario Bros. 30th Anniversary", jahr: 2015,
      liste: `
; Mario - Classic Colors
; Mario - Modern Colors`,
    },
    {
      name: "Super Nintendo World", jahr: 2021,
      liste: `
; Mario Power-Up Band
; Luigi Power-Up Band
; Peach Power-Up Band
; Daisy Power-Up Band
; Toad Power-Up Band
; Yoshi Power-Up Band
; Golden Power-Up Band
; Donkey Kong Power-Up Band
; Diddy Kong Power-Up Band
; Invincible Power-Up Band`,
    },
    {
      name: "Super Smash Bros.", jahr: 2014, nummer_von: 1, nummer_bis: 93,
      liste: `
1; Mario
2; Peach
3; Yoshi
4; Donkey Kong
5; Link
6; Fox
7; Samus
8; Wii Fit Trainer
9; Villager
10; Pikachu
11; Kirby
12; Marth
13; Zelda
14; Diddy Kong
15; Luigi
16; Little Mac
17; Pit
18; Captain Falcon
19; Rosalina
20; Bowser
21; Lucario
22; Toon Link
23; Sheik
24; Ike
25; Shulk
26; Sonic
27; Mega Man
; Mega Man - Gold Edition
28; King Dedede
29; Meta Knight
30; Robin
31; Lucina
32; Wario
33; Charizard
34; Ness
35; Pac-Man
36; Greninja
37; Jigglypuff
38; Palutena
39; Dark Pit
40; Zero Suit Samus
41; Ganondorf
42; Dr. Mario
43; Bowser Jr.
44; Olimar
45; Mr. Game & Watch
46; R.O.B. (NES)
47; Duck Hunt
48; Mii Brawler
49; Mii Swordfighter
50; Mii Gunner
51; Mewtwo
52; Falco
53; Lucas
54; R.O.B. (Famicom)
55; Roy
56; Ryu
57; Cloud
58; Cloud - Player 2
59; Corrin
60; Corrin - Player 2
61; Bayonetta
62; Bayonetta - Player 2
63; Wolf
64; Inkling
65; Ridley
66; Piranha Plant
67; King K. Rool
68; Ice Climbers
69; Ken
70; Young Link
71; Daisy
72; Pichu
73; Isabelle
74; Pokémon Trainer
75; Snake
76; Ivysaur
77; Squirtle
78; Simon
79; Incineroar
80; Chrom
81; Dark Samus
82; Richter
83; Joker
84; Hero
85; Banjo & Kazooie
86; Terry
87; Byleth
88; Min Min
89; Steve
; Alex
90; Sephiroth
91; Kazuya
92; Pyra
; Mythra
93; Sora`,
    },
    {
      name: "The Legend of Zelda", jahr: 2016,
      liste: `
; Wolf Link
; Link - The Legend of Zelda
; Link - Ocarina of Time
; Toon Link - The Wind Waker
; Zelda - The Wind Waker
; Link - Archer
; Link - Rider
; Guardian
; Zelda
; Bokoblin
; Link - Majora's Mask
; Link - Twilight Princess
; Link - Skyward Sword
; Mipha - Zora Champion
; Daruk - Goron Champion
; Revali - Rito Champion
; Urbosa - Gerudo Champion
; Link - Link's Awakening
; Zelda & Loftwing - Skyward Sword
; Link - Tears of the Kingdom
; Zelda - Tears of the Kingdom
; Ganondorf - Tears of the Kingdom
; Tulin
; Yunobo
; Sidon
; Riju
; Mineru's Construct`,
    },
    {
      name: "Xenoblade Chronicles", jahr: 2024,
      liste: `
; Noah
; Mio`,
    },
    {
      name: "Yoshi's Woolly World", jahr: 2015,
      liste: `
; Green Yarn Yoshi
; Pink Yarn Yoshi
; Light-Blue Yarn Yoshi
; Mega Yarn Yoshi
; Poochy`,
    },
    {
      name: "Animal Crossing Cards - New Leaf Welcome amiibo", merch_kategorie: 'karte', jahr: 2016, nummer_von: 1, nummer_bis: 50,
      liste: `
1; Vivian
2; Hopkins
3; June
4; Piper
5; Paolo
6; Hornsby
7; Stella
8; Tybalt
9; Huck
10; Sylvana
11; Boris
12; Wade
13; Carrie
14; Ketchup
15; Rex
16; Stu
17; Ursala
18; Jacob
19; Maddie
20; Billy
21; Boyd
22; Bitty
23; Maggie
24; Murphy
25; Plucky
26; Sandy
27; Claude
28; Raddle
29; Julia
30; Louie
31; Bea
32; Admiral
33; Ellie
34; Boots
35; Weber
36; Candi
37; Leopold
38; Spike
39; Cashmere
40; Tad
41; Norma
42; Gonzo
43; Sprocket
44; Snooty
45; Olive
46; Dobie
47; Buzz
48; Cleo
49; Ike
50; Tasha`,
    },
    {
      name: "Animal Crossing Cards - Promos", merch_kategorie: 'karte', jahr: 2015,
      liste: `
; Isabelle (Character Parfait)
; Goldie (amiibo Festival)
; Stitches (amiibo Festival)
; Rosie (amiibo Festival)
; K.K. Slider (Pikopuri)`,
    },
    {
      name: "Animal Crossing Cards - Series 1", merch_kategorie: 'karte', jahr: 2015, nummer_von: 1, nummer_bis: 100,
      liste: `
1; Isabelle
2; Tom Nook
3; DJ KK
4; Sable
5; Kapp'n
6; Resetti
7; Joan
8; Timmy
9; Digby
10; Pascal
11; Harriet
12; Redd
13; Saharah
14; Luna
15; Tortimer
16; Lyle
17; Lottie
18; Bob
19; Fauna
20; Curt
21; Portia
22; Leonardo
23; Cheri
24; Kyle
25; Al
26; Renée
27; Lopez
28; Jambette
29; Rasher
30; Tiffany
31; Sheldon
32; Bluebear
33; Bill
34; Kiki
35; Deli
36; Alli
37; Kabuki
38; Patty
39; Jitters
40; Gigi
41; Quillson
42; Marcie
43; Puck
44; Shari
45; Octavian
46; Winnie
47; Knox
48; Sterling
49; Bonbon
50; Punchy
51; Opal
52; Poppy
53; Limberg
54; Deena
55; Snake
56; Bangle
57; Phil
58; Monique
59; Nate
60; Samson
61; Tutu
62; T-Bone
63; Mint
64; Pudge
65; Midge
66; Gruff
67; Flurry
68; Clyde
69; Bella
70; Biff
71; Yuka
72; Lionel
73; Flo
74; Cobb
75; Amelia
76; Jeremiah
77; Cherry
78; Roscoe
79; Truffles
80; Eugene
81; Eunice
82; Goose
83; Annalisa
84; Benjamin
85; Pancetti
86; Chief
87; Bunnie
88; Clay
89; Diana
90; Axel
91; Muffy
92; Henry
93; Bertha
94; Cyrano
95; Peanut
96; Cole
97; Willow
98; Roald
99; Molly
100; Walker`,
    },
    {
      name: "Animal Crossing Cards - Series 2", merch_kategorie: 'karte', jahr: 2015, nummer_von: 101, nummer_bis: 200,
      liste: `
101; K.K.
102; Reese
103; Kicks
104; Labelle
105; Copper
106; Booker
107; Katie
108; Tommy
109; Porter
110; Leila
111; Shrunk
112; Don
113; Isabelle (Winter)
114; Blanca
115; Nat
116; Chip
117; Jack
118; Poncho
119; Felicity
120; Ozzie
121; Tia
122; Lucha
123; Fuchsia
124; Harry
125; Gwen
126; Coach
127; Kitt
128; Tom
129; Tipper
130; Prince
131; Pate
132; Vladimir
133; Savannah
134; Kidd
135; Phoebe
136; Egbert
137; Cookie
138; Sly
139; Blaire
140; Avery
141; Nana
142; Peck
143; Olivia
144; Cesar
145; Carmen
146; Rodney
147; Scoot
148; Whitney
149; Broccolo
150; Coco
151; Groucho
152; Wendy
153; Alfonso
154; Rhonda
155; Butch
156; Gabi
157; Moose
158; Timbra
159; Zell
160; Pekoe
161; Teddy
162; Mathilda
163; Ed
164; Bianca
165; Filbert
166; Kitty
167; Beau
168; Nan
169; Bud
170; Ruby
171; Benedict
172; Agnes
173; Julian
174; Bettina
175; Jay
176; Sprinkle
177; Flip
178; Hugh
179; Hopper
180; Pecan
181; Drake
182; Alice
183; Camofrog
184; Anicotti
185; Chops
186; Charlise
187; Vic
188; Ankha
189; Drift
190; Vesta
191; Marcel
192; Pango
193; Keaton
194; Gladys
195; Hamphrey
196; Freya
197; Kid Cat
198; Agent S
199; Big Top
200; Rocket`,
    },
    {
      name: "Animal Crossing Cards - Series 3", merch_kategorie: 'karte', jahr: 2016, nummer_von: 201, nummer_bis: 300,
      liste: `
201; Rover
202; Blathers
203; Tom Nook
204; Pelly
205; Phyllis
206; Pete
207; Mabel
208; Leif
209; Wendell
210; Cyrus
211; Grams
212; Timmy
213; Digby
214; Don
215; Isabelle (Kimono)
216; Franklin
217; Jingle
218; Lily
219; Anchovy
220; Tabby
221; Kody
222; Miranda
223; Del
224; Paula
225; Ken
226; Mitzi
227; Rodeo
228; Bubbles
229; Cousteau
230; Velma
231; Elvis
232; Canberra
233; Colton
234; Marina
235; Spork
236; Freckles
237; Bam
238; Friga
239; Ricky
240; Deirdre
241; Hans
242; Chevre
243; Drago
244; Tangy
245; Mac
246; Eloise
247; Wart Jr.
248; Hazel
249; Beardo
250; Ava
251; Chester
252; Merry
253; Genji
254; Greta
255; Wolfgang
256; Diva
257; Klaus
258; Daisy
259; Stinky
260; Tammi
261; Tucker
262; Blanche
263; Gaston
264; Marshal
265; Gala
266; Joey
267; Pippy
268; Buck
269; Bree
270; Rooney
271; Curlos
272; Skye
273; Moe
274; Flora
275; Hamlet
276; Astrid
277; Monty
278; Dora
279; Biskit
280; Victoria
281; Lyman
282; Violet
283; Frank
284; Chadder
285; Merengue
286; Cube
287; Claudia
288; Curly
289; Boomer
290; Caroline
291; Sparro
292; Baabara
293; Rolf
294; Maple
295; Antonio
296; Soleil
297; Apollo
298; Derwin
299; Francine
300; Chrissy`,
    },
    {
      name: "Animal Crossing Cards - Series 4", merch_kategorie: 'karte', jahr: 2016, nummer_von: 301, nummer_bis: 400,
      liste: `
301; Isabelle (Dress)
302; Brewster
303; Katrina
304; Phineas
305; Celeste
306; Tommy
307; Gracie
308; Leilani
309; Resetti
310; Timmy
311; Lottie
312; Shrunk
313; Pave
314; Gulliver
315; Redd
316; Zipper
317; Goldie
318; Stitches
319; Pinky
320; Mott
321; Mallary
322; Rocco
323; Katt
324; Graham
325; Peaches
326; Dizzy
327; Penelope
328; Boone
329; Broffina
330; Croque
331; Pashmina
332; Shep
333; Lolly
334; Erik
335; Dotty
336; Pierce
337; Queenie
338; Fang
339; Frita
340; Tex
341; Melba
342; Bones
343; Anabelle
344; Rudy
345; Naomi
346; Peewee
347; Tammy
348; Olaf
349; Lucy
350; Elmer
351; Puddles
352; Rory
353; Elise
354; Walt
355; Mira
356; Pietro
357; Aurora
358; Papi
359; Apple
360; Rod
361; Purrl
362; Static
363; Celia
364; Zucker
365; Peggy
366; Ribbot
367; Annalise
368; Chow
369; Sylvia
370; Jacques
371; Sally
372; Doc
373; Pompom
374; Tank
375; Becky
376; Rizzo
377; Sydney
378; Barold
379; Nibbles
380; Kevin
381; Gloria
382; Lobo
383; Hippeux
384; Margie
385; Lucky
386; Rosie
387; Rowan
388; Maelle
389; Bruce
390; O'Hare
391; Gayle
392; Cranston
393; Frobert
394; Grizzly
395; Cally
396; Simon
397; Iggly
398; Angus
399; Twiggy
400; Robin`,
    },
    {
      name: "Animal Crossing Cards - Series 5", merch_kategorie: 'karte', jahr: 2021, nummer_von: 401, nummer_bis: 448,
      liste: `
401; Tom Nook
402; Timmy & Tommy
403; Isabelle
404; Orville
405; Wilbur
406; Blathers
407; Celeste
408; Mabel
409; Sable
410; Label
411; K.K.
412; C.J.
413; Flick
414; Daisy Mae
415; Kicks
416; Saharah
417; Harvey
418; Gulliver
419; Wisp
420; Lottie
421; Niko
422; Wardell
423; Tom Nook (Coat)
424; Isabelle (Sweater)
425; Sherb
426; Megan
427; Dom
428; Audie
429; Cyd
430; Judy
431; Raymond
432; Reneigh
433; Sasha
434; Ione
435; Tiansheng
436; Shino
437; Marlo
438; Petri
439; Cephalobot
440; Quinn
441; Chabwick
442; Zoe
443; Ace
444; Rio
445; Frett
446; Azalea
447; Roswell
448; Faith`,
    },
    {
      name: "Animal Crossing x Sanrio Cards", merch_kategorie: 'karte', jahr: 2016, nummer_von: 1, nummer_bis: 6,
      liste: `
1; Rilla
2; Marty
3; Étoile
4; Chai
5; Chelsea
6; Toby`,
    },
    {
      name: "Mario Sports Superstars (Karten)", merch_kategorie: 'karte', jahr: 2017, nummer_von: 1, nummer_bis: 90,
      liste: `
1; Mario - Soccer
2; Mario - Baseball
3; Mario - Tennis
4; Mario - Golf
5; Mario - Horse Racing
6; Luigi - Soccer
7; Luigi - Baseball
8; Luigi - Tennis
9; Luigi - Golf
10; Luigi - Horse Racing
11; Peach - Soccer
12; Peach - Baseball
13; Peach - Tennis
14; Peach - Golf
15; Peach - Horse Racing
16; Daisy - Soccer
17; Daisy - Baseball
18; Daisy - Tennis
19; Daisy - Golf
20; Daisy - Horse Racing
21; Yoshi - Soccer
22; Yoshi - Baseball
23; Yoshi - Tennis
24; Yoshi - Golf
25; Yoshi - Horse Racing
26; Wario - Soccer
27; Wario - Baseball
28; Wario - Tennis
29; Wario - Golf
30; Wario - Horse Racing
31; Waluigi - Soccer
32; Waluigi - Baseball
33; Waluigi - Tennis
34; Waluigi - Golf
35; Waluigi - Horse Racing
36; Donkey Kong - Soccer
37; Donkey Kong - Baseball
38; Donkey Kong - Tennis
39; Donkey Kong - Golf
40; Donkey Kong - Horse Racing
41; Diddy Kong - Soccer
42; Diddy Kong - Baseball
43; Diddy Kong - Tennis
44; Diddy Kong - Golf
45; Diddy Kong - Horse Racing
46; Bowser - Soccer
47; Bowser - Baseball
48; Bowser - Tennis
49; Bowser - Golf
50; Bowser - Horse Racing
51; Bowser Jr. - Soccer
52; Bowser Jr. - Baseball
53; Bowser Jr. - Tennis
54; Bowser Jr. - Golf
55; Bowser Jr. - Horse Racing
56; Boo - Soccer
57; Boo - Baseball
58; Boo - Tennis
59; Boo - Golf
60; Boo - Horse Racing
61; Baby Mario - Soccer
62; Baby Mario - Baseball
63; Baby Mario - Tennis
64; Baby Mario - Golf
65; Baby Mario - Horse Racing
66; Baby Luigi - Soccer
67; Baby Luigi - Baseball
68; Baby Luigi - Tennis
69; Baby Luigi - Golf
70; Baby Luigi - Horse Racing
71; Birdo - Soccer
72; Birdo - Baseball
73; Birdo - Tennis
74; Birdo - Golf
75; Birdo - Horse Racing
76; Rosalina - Soccer
77; Rosalina - Baseball
78; Rosalina - Tennis
79; Rosalina - Golf
80; Rosalina - Horse Racing
81; Metal Mario - Soccer
82; Metal Mario - Baseball
83; Metal Mario - Tennis
84; Metal Mario - Golf
85; Metal Mario - Horse Racing
86; Pink Gold Peach - Soccer
87; Pink Gold Peach - Baseball
88; Pink Gold Peach - Tennis
89; Pink Gold Peach - Golf
90; Pink Gold Peach - Horse Racing`,
    },
    {
      name: "Power Pros (Karten)", merch_kategorie: 'karte', jahr: 2019, nummer_von: 1, nummer_bis: 6,
      liste: `
1; Pawapuro
2; Ikari
3; Yabe
4; Hayakawa
5; Ganda
6; Daijobu`,
    },
    {
      name: "Street Fighter 6 Booster Pack (Karten)", merch_kategorie: 'karte', jahr: 2025, nummer_von: 23, nummer_bis: 60,
      liste: `
23; M. Bison
24; Terry
25; Mai
26; Elena
27; Sagat
28; C. Viper
29; Alex
30; Ingrid
31; Luke
32; Jamie
33; Manon
34; Kimberly
35; Marisa
36; Lily
37; JP
38; Juri
39; Dee Jay
40; Cammy
41; Ryu
42; E. Honda
43; Blanka
44; Guile
45; Ken
46; Chun-Li
47; Zangief
48; Dhalsim
49; Rashid
50; A.K.I.
51; Ed
52; Akuma
53; M. Bison (Alt)
54; Terry (Alt)
55; Mai (Alt)
56; Elena (Alt)
57; Sagat (Alt)
58; C. Viper (Alt)
59; Alex (Alt)
60; Ingrid (Alt)`,
    },
    {
      name: "Street Fighter 6 Starter Set (Karten)", merch_kategorie: 'karte', jahr: 2025, nummer_von: 1, nummer_bis: 22,
      liste: `
1; Luke
2; Jamie
3; Manon
4; Kimberly
5; Marisa
6; Lily
7; JP
8; Juri
9; Dee Jay
10; Cammy
11; Ryu
12; E. Honda
13; Blanka
14; Guile
15; Ken
16; Chun-Li
17; Zangief
18; Dhalsim
19; Rashid
20; A.K.I.
21; Ed
22; Akuma`,
    },
    {
      name: "Super Mario Cereal (Karten)", merch_kategorie: 'karte', jahr: 2017,
      liste: `
; Super Mario Cereal`,
    },
    {
      name: "Yu-Gi-Oh! Rush Duel Saikyo Battle Royale (Karten)", merch_kategorie: 'karte', jahr: 2021, nummer_von: 1, nummer_bis: 7,
      liste: `
1; Yuga Ohdo
2; Tatsuhisa “Luke” Kamijo
3; Gakuto Sogetsu
4; Romin Kirishima
5; Roa Kirishima
6; Nail Saionji
7; Asana Mutsuba`,
    },
  ],
};
