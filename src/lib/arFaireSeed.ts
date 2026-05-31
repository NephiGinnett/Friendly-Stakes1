import { prisma } from "@/lib/db";

const SEEDED_QUIZZES: { title: string; author: string; tier?: string; imageUrl?: string; questions: { text: string; choiceA: string; choiceB: string; choiceC: string; correctIndex: number }[] }[] = [
  {
    title: "The Giver",
    author: "Lois Lowry",
    imageUrl: "https://covers.openlibrary.org/b/isbn/9780544336261-L.jpg",
    questions: [
      { text: "What is the protagonist's name?", choiceA: "Asher", choiceB: "Jonas", choiceC: "Caleb", correctIndex: 1 },
      { text: "What assignment is Jonas given at the Ceremony of Twelve?", choiceA: "Caretaker of the Old", choiceB: "Director of Recreation", choiceC: "Receiver of Memory", correctIndex: 2 },
      { text: "What is the name of the infant Jonas's father brings home to nurture?", choiceA: "Nathaniel", choiceB: "Gabriel", choiceC: "Caleb", correctIndex: 1 },
      { text: "What is the first color Jonas begins to perceive?", choiceA: "Blue", choiceB: "Yellow", choiceC: "Red", correctIndex: 2 },
      { text: "What does Jonas discover 'Release' truly means?", choiceA: "Banishment to Elsewhere", choiceB: "A festive ceremony", choiceC: "Death by lethal injection", correctIndex: 2 },
      { text: "Who gives Jonas his memories?", choiceA: "The Chief Elder", choiceB: "The Giver", choiceC: "His father", correctIndex: 1 },
      { text: "What does Jonas's community lack, which he experiences through memory?", choiceA: "Color, music, and real emotion", choiceB: "Advanced technology", choiceC: "Written language", correctIndex: 0 },
      { text: "What does Jonas take with him when he escapes?", choiceA: "The Giver's favorite books", choiceB: "Baby Gabriel", choiceC: "A sled", correctIndex: 1 },
      { text: "What rule is Jonas breaking by retaining memories given to him?", choiceA: "Sharing food outside mealtimes", choiceB: "Keeping secrets from the Chief Elder", choiceC: "Retaining memories rather than releasing them", correctIndex: 2 },
      { text: "What does Jonas experience at the end of the book?", choiceA: "He returns to the community", choiceB: "He and Gabriel reach a place with light and warmth", choiceC: "He is captured and Released", correctIndex: 1 },
    ],
  },
  {
    title: "To Kill a Mockingbird",
    author: "Harper Lee",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/To_Kill_a_Mockingbird_%28first_edition_cover%29.jpg/250px-To_Kill_a_Mockingbird_%28first_edition_cover%29.jpg",
    questions: [
      { text: "What is the narrator's name?", choiceA: "Jean Louise 'Scout' Finch", choiceB: "Jem Finch", choiceC: "Dill Harris", correctIndex: 0 },
      { text: "What crime is Tom Robinson accused of?", choiceA: "Theft", choiceB: "Murder", choiceC: "Rape", correctIndex: 2 },
      { text: "Who is the mysterious neighbor the children are fascinated by?", choiceA: "Miss Maudie", choiceB: "Boo Radley", choiceC: "Mr. Cunningham", correctIndex: 1 },
      { text: "What is Atticus Finch's profession?", choiceA: "Doctor", choiceB: "Farmer", choiceC: "Lawyer", correctIndex: 2 },
      { text: "What gifts do Scout and Jem find in the knothole of the tree?", choiceA: "Candy and money", choiceB: "Small treasures including soap figurines", choiceC: "Notes from Boo", correctIndex: 1 },
      { text: "Who saves Scout and Jem from Bob Ewell's attack?", choiceA: "Atticus", choiceB: "Boo Radley", choiceC: "Sheriff Tate", correctIndex: 1 },
      { text: "What town is the story set in?", choiceA: "Savannah, Georgia", choiceB: "Maycomb, Alabama", choiceC: "Montgomery, Alabama", correctIndex: 1 },
      { text: "What does the title symbolize?", choiceA: "Hunting wildlife for sport", choiceB: "Harming an innocent being", choiceC: "Southern tradition", correctIndex: 1 },
      { text: "What happens to Tom Robinson?", choiceA: "He is acquitted", choiceB: "He escapes to the North", choiceC: "He is convicted and later shot trying to escape", correctIndex: 2 },
      { text: "What lesson does Atticus most famously teach Scout?", choiceA: "Never trust strangers", choiceB: "Climb into someone else's skin and walk around in it", choiceC: "Always obey the law", correctIndex: 1 },
    ],
  },
  {
    title: "The Outsiders",
    author: "S.E. Hinton",
    imageUrl: "https://covers.openlibrary.org/b/isbn/9780140385724-L.jpg",
    questions: [
      { text: "What are the two rival gangs in the novel?", choiceA: "Greasers and Socs", choiceB: "Jets and Sharks", choiceC: "Cobras and Tigers", correctIndex: 0 },
      { text: "Who narrates The Outsiders?", choiceA: "Johnny", choiceB: "Dally", choiceC: "Ponyboy", correctIndex: 2 },
      { text: "What does Johnny do to Bob during the park confrontation?", choiceA: "Punches him", choiceB: "Stabs and kills him", choiceC: "Knocks him unconscious", correctIndex: 1 },
      { text: "Where do Ponyboy and Johnny hide after the incident?", choiceA: "An abandoned church", choiceB: "A storm drain", choiceC: "Dally's apartment", correctIndex: 0 },
      { text: "What book does Ponyboy read to Johnny while hiding?", choiceA: "The Great Gatsby", choiceB: "Gone with the Wind", choiceC: "To Kill a Mockingbird", correctIndex: 1 },
      { text: "How does Johnny die?", choiceA: "In a rumble with the Socs", choiceB: "Shot by police", choiceC: "From burns sustained rescuing children from the fire", correctIndex: 2 },
      { text: "What are Johnny's last words to Ponyboy?", choiceA: "Stay gold", choiceB: "Nothing gold can stay", choiceC: "We'll meet again", correctIndex: 0 },
      { text: "What poem becomes a central theme of the novel?", choiceA: "The Road Not Taken", choiceB: "Nothing Gold Can Stay", choiceC: "Stopping by Woods on a Snowy Evening", correctIndex: 1 },
      { text: "What happens to Dally at the end of the novel?", choiceA: "He moves away", choiceB: "He is killed by police after Johnny dies", choiceC: "He joins the Socs", correctIndex: 1 },
      { text: "What is the narrator's full name?", choiceA: "Ponyboy Michael Curtis", choiceB: "Ponyboy James Curtis", choiceC: "Ponyboy Curtis Johnson", correctIndex: 0 },
    ],
  },
  {
    title: "Harry Potter and the Sorcerer's Stone",
    author: "J.K. Rowling",
    imageUrl: "https://covers.openlibrary.org/b/isbn/9780439708180-L.jpg",
    questions: [
      { text: "What is Harry Potter's address before going to Hogwarts?", choiceA: "12 Grimmauld Place", choiceB: "4 Privet Drive", choiceC: "The Burrow", correctIndex: 1 },
      { text: "What house is Harry sorted into?", choiceA: "Slytherin", choiceB: "Ravenclaw", choiceC: "Gryffindor", correctIndex: 2 },
      { text: "What guards the Sorcerer's Stone?", choiceA: "A basilisk", choiceB: "A three-headed dog named Fluffy", choiceC: "A dragon", correctIndex: 1 },
      { text: "Who is revealed to be the villain trying to steal the Stone?", choiceA: "Snape", choiceB: "Dumbledore", choiceC: "Quirrell", correctIndex: 2 },
      { text: "What is the name of the goblin bank?", choiceA: "Vaultshire", choiceB: "Gringotts", choiceC: "Dragonsbank", correctIndex: 1 },
      { text: "What sport is played on broomsticks?", choiceA: "Quodpot", choiceB: "Bludging", choiceC: "Quidditch", correctIndex: 2 },
      { text: "What is Harry's owl named?", choiceA: "Errol", choiceB: "Hedwig", choiceC: "Crookshanks", correctIndex: 1 },
      { text: "What does the Mirror of Erised show?", choiceA: "The future", choiceB: "Your greatest fear", choiceC: "Your deepest desire", correctIndex: 2 },
      { text: "Who is Harry's first friend at Hogwarts?", choiceA: "Ron Weasley", choiceB: "Neville Longbottom", choiceC: "Hermione Granger", correctIndex: 0 },
      { text: "What does the Sorcerer's Stone grant according to the story?", choiceA: "Unlimited magical power", choiceB: "The ability to speak to animals", choiceC: "Immortality and the ability to turn metal to gold", correctIndex: 2 },
    ],
  },
  {
    title: "The Hunger Games",
    author: "Suzanne Collins",
    imageUrl: "https://covers.openlibrary.org/b/isbn/9780439023481-L.jpg",
    questions: [
      { text: "What is the protagonist's name?", choiceA: "Prim Everdeen", choiceB: "Katniss Everdeen", choiceC: "Clove", correctIndex: 1 },
      { text: "What district is Katniss from?", choiceA: "District 12", choiceB: "District 7", choiceC: "District 1", correctIndex: 0 },
      { text: "What does 'reaping' refer to?", choiceA: "The harvest festival", choiceB: "The selection of tributes for the Hunger Games", choiceC: "The punishment of rebels", correctIndex: 1 },
      { text: "Who volunteers at the reaping in place of Prim?", choiceA: "Rue", choiceB: "Katniss", choiceC: "Madge", correctIndex: 1 },
      { text: "What is the male tribute from District 12 named?", choiceA: "Finnick", choiceB: "Cato", choiceC: "Peeta Mellark", correctIndex: 2 },
      { text: "What skill makes Katniss especially dangerous in the Games?", choiceA: "Hand-to-hand combat", choiceB: "Archery", choiceC: "Knife throwing", correctIndex: 1 },
      { text: "What rule change temporarily allows two victors?", choiceA: "Both tributes from the same district can win", choiceB: "Alliances can be declared official", choiceC: "Any tribute can forfeit", correctIndex: 0 },
      { text: "What berries do Katniss and Peeta threaten to eat?", choiceA: "Blueberries", choiceB: "Nightlock", choiceC: "Tracker jacker berries", correctIndex: 1 },
      { text: "Who is the young tribute from District 11 that Katniss allies with?", choiceA: "Thresh", choiceB: "Foxface", choiceC: "Rue", correctIndex: 2 },
      { text: "What is the name of the televised death match?", choiceA: "The Reaping", choiceB: "The Hunger Games", choiceC: "The Capitol Games", correctIndex: 1 },
    ],
  },
  {
    title: "Naruto",
    author: "Masashi Kishimoto",
    imageUrl: "https://covers.openlibrary.org/b/isbn/9781569319000-L.jpg",
    questions: [
      { text: "What is the name of Naruto's home village?", choiceA: "Sunagakure", choiceB: "Konohagakure", choiceC: "Kirigakure", correctIndex: 1 },
      { text: "What is the name of the Nine-Tails fox spirit sealed within Naruto?", choiceA: "Shukaku", choiceB: "Gyuki", choiceC: "Kurama", correctIndex: 2 },
      { text: "Who leads Team 7 as their jonin instructor?", choiceA: "Iruka Umino", choiceB: "Kakashi Hatake", choiceC: "Jiraiya", correctIndex: 1 },
      { text: "What is the name of Sasuke's older brother who massacred the Uchiha clan?", choiceA: "Madara", choiceB: "Obito", choiceC: "Itachi", correctIndex: 2 },
      { text: "What is Naruto's signature high-level technique, taught by Jiraiya?", choiceA: "Rasengan", choiceB: "Chidori", choiceC: "Shadow Clone Jutsu", correctIndex: 0 },
    ],
  },
  {
    title: "Red Rising",
    author: "Pierce Brown",
    imageUrl: "https://covers.openlibrary.org/b/isbn/9780345539786-L.jpg",
    questions: [
      { text: "What color caste is Darrow born into?", choiceA: "Gold", choiceB: "Red", choiceC: "Silver", correctIndex: 1 },
      { text: "What is the name of the highest color caste in the Society?", choiceA: "Platinum", choiceB: "Diamond", choiceC: "Gold", correctIndex: 2 },
      { text: "On what planet does the story primarily begin?", choiceA: "Earth", choiceB: "Mars", choiceC: "Jupiter", correctIndex: 1 },
      { text: "What organization recruits Darrow to be carved into a Gold and infiltrate their society?", choiceA: "Mustang's resistance", choiceB: "The Sons of Ares", choiceC: "The Obsidians", correctIndex: 1 },
      { text: "What is the name of the elite school where Gold youths compete that Darrow infiltrates?", choiceA: "The Institute", choiceB: "The Academy", choiceC: "Pax Academy", correctIndex: 0 },
    ],
  },
  {
    title: "To Live",
    author: "Yu Hua",
    imageUrl: "https://covers.openlibrary.org/b/isbn/9781400031702-L.jpg",
    questions: [
      { text: "What is the main character's name in 'To Live'?", choiceA: "Fugui", choiceB: "Jiazhen", choiceC: "Chunsheng", correctIndex: 0 },
      { text: "What does Fugui lose through gambling early in the story?", choiceA: "His reputation and title", choiceB: "His family's land and fortune", choiceC: "His wife", correctIndex: 1 },
      { text: "Which historical events form the backdrop of most of the novel?", choiceA: "The Boxer Rebellion", choiceB: "China's Republican era", choiceC: "The Great Leap Forward and Cultural Revolution", correctIndex: 2 },
      { text: "What animal companion does Fugui work alongside in his old age?", choiceA: "A horse", choiceB: "An ox", choiceC: "A mule", correctIndex: 1 },
      { text: "What is the central theme of 'To Live'?", choiceA: "Political revolution and justice", choiceB: "Endurance and finding meaning through suffering and loss", choiceC: "The pursuit of material success", correctIndex: 1 },
    ],
  },
  {
    title: "Trolls: World Tour",
    author: "Walt Dohrn & David P. Smith (dirs.)",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/e/ed/Trolls_World_Tour_poster.jpg/250px-Trolls_World_Tour_poster.jpg",
    questions: [
      { text: "Who is the main antagonist in Trolls: World Tour?", choiceA: "King Gristle", choiceB: "Chef", choiceC: "Queen Barb", correctIndex: 2 },
      { text: "What are the magical strings in Trolls: World Tour capable of?", choiceA: "Granting any wish", choiceB: "Controlling all music", choiceC: "Summoning ancient trolls", correctIndex: 1 },
      { text: "Which troll tribe do Poppy and Branch encounter first on their journey?", choiceA: "Techno Trolls", choiceB: "Country Trolls", choiceC: "Classical Trolls", correctIndex: 1 },
      { text: "What is Queen Barb's ultimate goal with the magical strings?", choiceA: "Destroy all other music and make rock the only genre", choiceB: "Unite all troll tribes under one ruler", choiceC: "Restore the ancient troll world", correctIndex: 0 },
      { text: "What does Poppy realize by the end of the film about music?", choiceA: "Rock music is the most powerful", choiceB: "Each tribe's music should remain completely separate", choiceC: "Different music can coexist and enrich each other", correctIndex: 2 },
    ],
  },
  {
    title: "Marty Supreme",
    author: "Harmony Korine (dir.)",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/b/ba/Marty_Supreme_poster.jpg/250px-Marty_Supreme_poster.jpg",
    questions: [
      { text: "Who directed Marty Supreme?", choiceA: "Wes Anderson", choiceB: "Spike Jonze", choiceC: "Harmony Korine", correctIndex: 2 },
      { text: "Who stars as the title character Marty?", choiceA: "Jonah Hill", choiceB: "Adam Sandler", choiceC: "Seth Rogen", correctIndex: 0 },
      { text: "What sport is central to Marty Supreme?", choiceA: "Pool/billiards", choiceB: "Street chess", choiceC: "Ping pong", correctIndex: 2 },
      { text: "How would you best describe the visual style of Marty Supreme?", choiceA: "Naturalistic documentary realism", choiceB: "Surrealist fever dream", choiceC: "Polished studio blockbuster", correctIndex: 1 },
      { text: "What best describes Marty's identity in the film?", choiceA: "A ping pong hustler and self-styled champion", choiceB: "A retired athlete coaching a protégé", choiceC: "A tournament organizer seeking revenge", correctIndex: 0 },
    ],
  },
  {
    title: "Dungeon Crawler Carl",
    author: "Matt Dillon",
    tier: "epic",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/f/f9/DungeonCrawlerCarlBook1.png",
    questions: [
      { text: "Who is the author of the Dungeon Crawler Carl series?", choiceA: "Travis Baldree", choiceB: "Matt Dillon", choiceC: "Andrew Rowe", correctIndex: 1 },
      { text: "What is Princess Donut?", choiceA: "An NPC Carl finds in the first dungeon level", choiceB: "A magical familiar who bonded with Carl by choice", choiceC: "Carl's cat, carried into the apocalypse with him", correctIndex: 2 },
      { text: "How does the dungeon world come into existence?", choiceA: "A wizard opens a dimensional rift", choiceB: "Aliens abruptly collapse Earth's surface into layered dungeon floors", choiceC: "A nuclear catastrophe forces survivors underground", correctIndex: 1 },
      { text: "What transforms the dungeon crawl into more than just a survival event?", choiceA: "The world's governments broadcast it as propaganda", choiceB: "Survivors vote on each other's fates weekly", choiceC: "It is transmitted as intergalactic reality television watched across the galaxy", correctIndex: 2 },
      { text: "What is the name of Princess Donut's NPC trainer?", choiceA: "Grimshaw", choiceB: "Mordecai", choiceC: "Aldric", correctIndex: 1 },
      { text: "Which corporation is revealed to be running the dungeon system?", choiceA: "Galactic Entertainment Corp", choiceB: "The Syndicate", choiceC: "Borant Corporation", correctIndex: 2 },
      { text: "What was Princess Donut before the apocalypse?", choiceA: "A stray cat Carl rescued", choiceB: "His ex-girlfriend's cat", choiceC: "A show cat he won in a competition", correctIndex: 1 },
      { text: "What genre best describes Dungeon Crawler Carl?", choiceA: "LitRPG / progression fantasy", choiceB: "Military science fiction", choiceC: "High fantasy epic", correctIndex: 0 },
      { text: "What characterizes Carl's combat style compared to a typical fantasy hero?", choiceA: "Reliance on powerful magic spells", choiceB: "Careful diplomacy and avoidance of conflict", choiceC: "Improvised tactics and brute force stubbornness", correctIndex: 2 },
      { text: "What is the overall tone of the Dungeon Crawler Carl series?", choiceA: "Grimly humorless and relentlessly dark", choiceB: "Darkly humorous, action-packed, and unexpectedly emotional", choiceC: "A lighthearted adventure aimed at younger readers", correctIndex: 1 },
    ],
  },
];

export async function seedArFaireQuizzes() {
  const existing = await prisma.arQuiz.count({ where: { status: "seeded" } });
  if (existing >= SEEDED_QUIZZES.length) return;

  for (const q of SEEDED_QUIZZES) {
    const exists = await prisma.arQuiz.findFirst({ where: { title: q.title, status: "seeded" } });
    if (exists) continue;
    const tier = q.tier ?? "uncommon";
    const imageUrl = q.imageUrl ?? "";
    const quiz = await prisma.arQuiz.create({
      data: {
        title: q.title,
        author: q.author,
        tier,
        status: "seeded",
        imageUrl,
        questions: {
          create: q.questions.map((question, i) => ({
            order: i,
            text: question.text,
            choiceA: question.choiceA,
            choiceB: question.choiceB,
            choiceC: question.choiceC,
            correctIndex: question.correctIndex,
          })),
        },
      },
    });
    // Create a placeholder bookmark for each seeded quiz
    await prisma.arBookmark.create({
      data: {
        label: q.title,
        imageUrl,
        tier,
        quizId: quiz.id,
      },
    });
  }
}
