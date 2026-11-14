/* A small built-in sample of common English given names (lowercase a–z).
   The lectures use names.txt with ~32,000 names; this page trains on this sample in the browser. */
(function () {
  const raw = `
emma olivia ava isabella sophia charlotte mia amelia harper evelyn abigail emily elizabeth mila ella avery sofia camila aria scarlett
victoria madison luna grace chloe penelope layla riley zoey nora lily eleanor hannah lillian addison aubrey ellie stella natalie zoe
leah hazel violet aurora savannah audrey brooklyn bella claire skylar lucy paisley everly anna caroline nova genesis emilia kennedy
samantha maya willow kinsley naomi aaliyah elena sarah ariana allison gabriella alice madelyn cora ruby eva serenity autumn adeline
hailey gianna valentina isla eliana quinn nevaeh ivy sadie piper lydia alexa josephine emery julia delilah arianna vivian kaylee
sophie brielle madeline peyton rylee clara hadley melanie mackenzie reagan adalynn liliana aubree jade katherine isabelle natalia
raelynn maria athena ximena arya leilani taylor faith rose kylie alexandra mary margaret lyla ashley amaya eliza brianna bailey
andrea khloe jasmine melody iris isabel norah annabelle valeria emerson adalyn ryleigh eden emersyn anastasia kayla alyssa juliana
charlie esther ariel cecilia valerie alina molly reese aliyah lilly parker finley morgan sydney jordyn eloise trinity daisy kimberly
lauren genevieve sara arabella harmony elise remi teagan alexis london sloane laila lucia diana juliette sienna elliana londyn ayla
callie gracie josie amara jocelyn daniela everleigh mya rachel summer alana brooke alaina mckenzie catherine amy presley journee
rosalie ember brynlee rowan joanna paige rebecca ana sawyer mariah nicole brooklynn payton marley fiona georgia lila harley adelyn
alivia noelle gemma vanessa journey makayla angelina adaline catalina alayna julianna leila lola adriana june juliet jayla river
tessa lia dakota delaney selena blakely ada camille zara malia hope samara alaia myla brynn kiara lena julie kate jane miriam
liam noah william james oliver benjamin elijah lucas mason logan alexander ethan jacob michael daniel henry jackson sebastian aiden
matthew samuel david joseph carter owen wyatt john jack luke jayden dylan grayson levi isaac gabriel julian mateo anthony jaxon
lincoln joshua christopher andrew theodore caleb ryan asher nathan thomas leo isaiah charles josiah hudson christian hunter connor
eli ezra aaron landon adrian jonathan nolan jeremiah easton elias colton cameron carson robert angel maverick nicholas dominic
jaxson greyson adam ian austin santiago jordan cooper brayden roman evan ezekiel xavier jose jace jameson leonardo bryson axel
everett kayden miles sawyer jason declan weston micah ayden wesley luca vincent damian zachary silas gavin chase kai emmett
harrison nathaniel kingston cole tyler bennett bentley ryker tristan brandon kevin luis george ashton braxton ryder gael ivan
diego maxwell max carlos kaiden juan maddox justin waylon calvin giovanni jonah abel jayce jesus amir king beau camden alex
jasper malachi brody jude blake emmanuel eric brooks elliot antonio abraham timothy finn rhett elliott edward august xander alan
dean lorenzo bryce karter victor milo miguel hayden graham grant zion tucker jesse zayden joel richard patrick emiliano nicolas
brantley dawson myles matteo steven thiago zane matias judah jeremy preston oscar kaleb alejandro marcus mark peter maximus
barrett jax andres holden legend knox kaden paxton kyrie kyle griffin josue kenneth beckett enzo adriel arthur felix bryan
lukas paul brian colt caden leon archer omar israel aidan theo javier remington jaden bradley emilio colin cayden phoenix
clayton simon ace nash derek rafael zander brady jorge jake louis damien karson walker amari sean chance walter martin
tobias cash corbin arlo iker erick gunner cody stephen francisco killian dallas reid manuel lane atlas rylan jensen ronan
beckham daxton anderson kameron raymond orion cristian tanner kyler jett cohen ricardo spencer gideon ali fernando jaiden titus
travis bodhi eduardo dante ellis prince kane luka kash hendrix desmond donovan mario atticus cruz garrett hector angelo jeffrey
edwin cesar zayn devin conor warren odin romeo julius jaylen hayes kayson muhammad jaxton joaquin caiden marshall johnny kade
edgar leonel ismael marco tyson wade collin troy nasir conner adonis jared rory andy jase lennox shane malik ari reed seth
clark erik lawson trevor gage nico malakai cade johnathan sullivan solomon cyrus fabian pedro frank shawn malcolm khalil
nehemiah dalton mathias jay ibrahim winston kason zachariah`;
  const seen = new Set();
  const names = [];
  for (const w of raw.split(/\s+/)) {
    if (!w || !/^[a-z]+$/.test(w) || seen.has(w)) continue;
    seen.add(w); names.push(w);
  }
  window.NAMES = names;
  window.CHARS = '.abcdefghijklmnopqrstuvwxyz';
  window.stoi = (c) => window.CHARS.indexOf(c);
})();
