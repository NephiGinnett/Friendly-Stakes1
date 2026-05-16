import { prisma } from "@/lib/db";

const SEEDED_QUIZZES = [
  {
    title: "The Giver",
    author: "Lois Lowry",
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
];

export async function seedArFaireQuizzes() {
  const existing = await prisma.arQuiz.count({ where: { status: "seeded" } });
  if (existing >= SEEDED_QUIZZES.length) return;

  for (const q of SEEDED_QUIZZES) {
    const exists = await prisma.arQuiz.findFirst({ where: { title: q.title, status: "seeded" } });
    if (exists) continue;
    const quiz = await prisma.arQuiz.create({
      data: {
        title: q.title,
        author: q.author,
        tier: "uncommon",
        status: "seeded",
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
        imageUrl: "",
        tier: "uncommon",
        quizId: quiz.id,
      },
    });
  }
}
