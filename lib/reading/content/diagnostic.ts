import type { PassageDraft } from "../content-model";
import { match, mc, short, tf } from "./helpers";

/** The two passages of the free starting assessment. Authored for this studio; the figures in the second passage are invented for the exercise. */
export const DIAGNOSTIC: PassageDraft[] = [
  {
    slug: "rooftop-gardens",
    title: "Rooftop Gardens in Crowded Cities",
    topic: "environment",
    difficulty: 2,
    vocabLevel: 2,
    levelKey: null,
    isDiagnostic: true,
    body: `In many crowded cities, the flat roofs of office blocks and apartment buildings stand empty. Over the past decade, a growing number of residents have begun turning these spaces into gardens, and the results have surprised even the people who started them.

The most visible benefit is food. A single well-tended rooftop plot of about forty square metres can supply a small apartment block with salad leaves, herbs and tomatoes for most of the warm season. Gardeners say that vegetables picked an hour before eating taste better, but this is a matter of opinion; what can be measured is the saving on transport, since the produce travels only a few flights of stairs.

Roof gardens also change the buildings beneath them. A layer of soil and plants absorbs heat in summer, so top-floor rooms can be several degrees cooler than those under a bare roof. In winter the same layer slows the loss of warmth. Engineers caution, however, that a roof must be checked before any garden is built. Wet soil is heavy, and an older roof that was never designed to carry it may need strengthening first, which can cost more than the garden itself.

Not everyone is convinced. Some building managers worry about leaks and about who is responsible if water damages a flat below. Others point out that gardens need regular care, and that plots often fall into neglect when the enthusiastic founders move away. A few cities have responded by offering small grants to groups that agree to look after a garden for at least five years.

Despite these doubts, supporters argue that the gardens do something numbers cannot capture. Neighbours who never spoke in the stairwell now meet over the tomato plants, and children learn where food comes from. For many residents, that is reason enough to carry the compost up the stairs.`,
    questions: [
      mc("DG1-1", "diagnostic", "main_idea", "interpret", 1, 35, "Which statement best expresses the main idea of the passage?",
        ["Roof gardens are cheap to build and should now replace most other forms of farming in cities.","Rooftop gardens bring food, cooling and community benefits, but raise practical concerns.","Engineers disagree about whether any city roof can ever be used for a garden safely.","Vegetables grown on rooftops taste far better than those sold in shops, say gardeners."], 1,
        "The passage covers food, cooler buildings and community, then the worries about weight, leaks and care, so B captures the whole. A is never claimed (the passage says strengthening can be costly). C overstates the engineers' caution. D is only the gardeners' opinion and covers one sentence."),
      mc("DG1-2", "diagnostic", "details", "locate", 1, 30, "About how large is the plot that the passage says can supply a small apartment block for most of the warm season?",
        ["Ten square metres", "Twenty square metres", "Forty square metres", "Four hundred square metres"], 2,
        "The second paragraph says \"about forty square metres\". The other sizes do not appear."),
      mc("DG1-3", "diagnostic", "fact_opinion", "interpret", 2, 40, "Which of these is presented in the passage as an opinion rather than something that can be measured?",
        ["Top-floor rooms can be several degrees cooler than those under a bare roof.","Vegetables picked an hour before eating taste better.","The produce travels only a few flights of stairs to the kitchen.","Some cities offer small grants to groups that promise to look after a garden."], 1,
        "The passage itself labels the taste claim \"a matter of opinion\". The temperature, the short transport distance and the grants are all things that could be checked."),
      mc("DG1-4", "diagnostic", "relationships", "interpret", 2, 40, "According to the passage, why might an older roof need strengthening before a garden is built?",
        ["Plant roots can damage old tiles and the waterproof layer under them.","Wet soil is heavy, and the roof may not have been designed to carry it.","Building managers refuse to allow gardens on roofs that are not strengthened.","City grants require a structural check before any money is paid out."], 1,
        "The third paragraph gives the reason directly: wet soil is heavy and an older roof \"was never designed to carry it\". Roots, managers' refusal and grant conditions are not given as reasons for strengthening."),
      mc("DG1-5", "diagnostic", "vocab_context", "interpret", 2, 35, "In the last paragraph, supporters say the gardens do something numbers cannot capture. Here \"capture\" most nearly means:",
        ["defeat by using force","take a picture of something","express or record in full","seize and keep hold of"], 2,
        "Numbers cannot fully express or record the community benefit. \"Win by force\" and \"take hold of\" are other meanings of the word that do not fit a sentence about numbers; nothing is being photographed."),
      mc("DG1-6", "diagnostic", "inference", "infer", 3, 55, "Which can most reasonably be inferred from the fourth paragraph?",
        ["Most roof gardens in these crowded cities have been abandoned within a few seasons of opening.","Without long-term care a garden may not last, so some cities attach a condition to grants.","Building managers oppose every roof garden because of the risk of leaks.","The grants are large enough to cover the cost of strengthening an older roof."], 1,
        "Plots \"often fall into neglect\" when founders leave, and grants require five years of care: B links the two. A overstates (often is not most). C overstates (\"some\" managers). D has no support: the grants are described as small."),
      mc("DG1-7", "diagnostic", "details", "negation", 2, 45, "All of the following are given as benefits of rooftop gardens EXCEPT:",
        ["cooler top-floor rooms during the summer months","slower loss of warmth through the winter months","lower cost of strengthening old roofs","neighbours meeting one another over the plants"], 2,
        "Strengthening old roofs is described as a possible extra cost, not a benefit. The other three appear as benefits in paragraphs three and five."),
      mc("DG1-8", "diagnostic", "purpose_tone", "interpret", 2, 40, "The author's tone towards rooftop gardens is best described as:",
        ["enthusiastic and uncritical throughout","hostile towards the idea of rooftop gardens","balanced, but broadly positive","indifferent to whether the gardens succeed"], 2,
        "The author gives the benefits, reports the doubts fairly, and ends on the supporters' view. That is balanced and leans positive. It is not uncritical because the problems are described in detail."),
      mc("DG1-R1", "recall", "recall_details", "locate", 1, 25, "For how many years must groups promise to look after a garden to receive a grant in some cities?",
        ["One year", "Three years", "Five years", "Ten years"], 2,
        "Grants go to groups that agree to look after a garden \"for at least five years\"."),
      mc("DG1-R2", "recall", "recall_links", "interpret", 2, 35, "What problem did the passage link to the weight of wet soil?",
        ["Water leaking through the roof into a flat below","An older roof possibly needing strengthening","Vegetables losing their flavour","Gardens falling into neglect"], 1,
        "Heavy wet soil is linked to roofs that may need strengthening. Leaks and neglect are separate worries raised by managers."),
    ],
  },
  {
    slug: "screens-and-paper",
    title: "Reading on Paper and on a Tablet",
    topic: "education",
    difficulty: 3,
    vocabLevel: 3,
    levelKey: null,
    isDiagnostic: true,
    body: `A school librarian wanted to know whether the way pupils read affects how much they remember. She asked 120 students aged 14 to 15 to read the same 900-word article and then answer ten questions. Students chose whether to read on paper or on a tablet; sixty chose each. She did not tell them that their answers would be compared.

| Group | Average score out of 10 | Average reading time (minutes) |
| Paper | 7.1 | 4.8 |
| Tablet | 6.4 | 4.1 |

The librarian noticed two things. Students who read on tablets finished faster but scored lower on average. When she looked more closely at the questions, the gap was largest on those asking about the order in which events happened, and almost absent on those asking for a single fact.

She was careful about her conclusions. "It would be easy to say that tablets make students read worse," she wrote, "but this was one article, one school and one afternoon." She added that some tablet readers said they scrolled back and forth and lost their place, which might explain the order questions. She also noted that, because students chose their own format, those in the tablet group were more often students who read on screens at home, so the groups may have differed before anyone read a word.

Her recommendation was modest: teachers could let students choose the format they find easier for casual reading but, for material that must be remembered in sequence, consider printed copies. A colleague disagreed, arguing that students should be trained to use screens well rather than steered away from them, since screens will only become more common. The librarian replied that the two ideas were not in conflict.`,
    questions: [
      mc("DG2-1", "diagnostic", "data", "locate", 1, 30, "According to the table, what was the average reading time of the tablet group?",
        ["4.8 minutes", "4.1 minutes", "6.4 minutes", "7.1 minutes"], 1,
        "The table gives 4.1 minutes for the tablet group. 4.8 is the paper group's time; 6.4 and 7.1 are scores, not times."),
      mc("DG2-2", "diagnostic", "data", "multi_evidence", 2, 45, "Which comparison between the two groups does the table support?",
        ["Tablet readers read faster and scored lower.", "Tablet readers read faster and scored higher.", "Paper readers read faster and scored lower.", "Both groups scored the same."], 0,
        "Tablet: 4.1 minutes and 6.4. Paper: 4.8 minutes and 7.1. So tablet readers were quicker and scored lower. The other options reverse or ignore one of the two columns."),
      mc("DG2-3", "diagnostic", "main_idea", "interpret", 2, 40, "What is the main point of the passage?",
        ["Tablets harm students' ability to read, so schools should stop using them.","One small survey found a gap, and its author urged caution about it.","Printed books should replace screens in schools because they work better.","Students remember more when they read faster than their classmates."], 1,
        "The librarian reports a difference and then lists reasons not to over-read it. A and C go further than she does. D is contradicted: the faster group scored lower."),
      mc("DG2-4", "diagnostic", "details", "locate", 2, 35, "The gap between the groups was largest on questions about:",
        ["a single fact stated once in the article","the meaning of difficult words in the text","the order in which events happened","the title and layout of the article itself"], 2,
        "The third paragraph says the gap was largest on questions about the order of events and almost absent on single-fact questions."),
      mc("DG2-5", "diagnostic", "arguments", "supported", 3, 55, "Which weakness in the study does the passage identify?",
        ["The article was far too short to give a fair test of anyone's reading ability.","Students chose their own format, so the groups may already have differed.","Students were told in advance that their answers would be compared with others.","Only paper readers were tested."], 1,
        "She notes that students chose their own format, so the groups may have differed already. C is the opposite of what is stated: they were not told. D is false: both groups were tested. A is not mentioned."),
      mc("DG2-6", "diagnostic", "conclusion", "conclude", 3, 55, "Which conclusion is best supported by the passage?",
        ["Reading on tablets causes students to score lower, so schools should avoid them.","Students who read on screens at home read worse than the students who prefer paper.","Paper should be banned for casual reading.","Tablet readers scored lower here, but the survey cannot show the tablet caused it."], 3,
        "The librarian herself says the evidence is one article, one school and one afternoon, with groups that may have differed. D reports the finding without claiming cause. A and B claim a cause or a link the survey cannot show; C is not recommended anywhere."),
      mc("DG2-7", "diagnostic", "fact_opinion", "interpret", 2, 40, "Which of these is the colleague's opinion rather than a recorded result?",
        ["Tablet readers averaged 6.4 out of 10 on the ten questions.","Sixty students chose paper and sixty chose the tablet.","Students should be trained to use screens well.","Tablet readers took 4.1 minutes to finish the article on average."], 2,
        "What students \"should\" do is a judgement. The scores, group sizes and times are recorded results."),
      mc("DG2-8", "diagnostic", "vocab_context", "interpret", 2, 35, "In the last paragraph, \"modest\" in \"Her recommendation was modest\" most nearly means:",
        ["quiet and a little shy about it","limited in what it claimed","inexpensive to put into practice","unwilling to say what she thought"], 1,
        "A modest recommendation does not claim much: it suggests choice for casual reading and print only for material needing sequence. \"Shy\" and \"unwilling to speak\" describe people, not a recommendation."),
      mc("DG2-R1", "recall", "recall_details", "locate", 1, 25, "Which format had the higher average score in the librarian's survey?",
        ["Paper", "Tablet", "They were the same", "The passage does not say"], 0,
        "Paper readers averaged 7.1 against 6.4 for tablet readers."),
      mc("DG2-R2", "recall", "recall_links", "interpret", 2, 35, "What reason did the librarian give for why tablet readers might have done worse on order questions?",
        ["The screens were too bright to read comfortably for long.","They scrolled back and forth and lost their place.","They were given far less time than the paper readers had.","They knew in advance that the answers would be compared."], 1,
        "She reported that some tablet readers scrolled back and forth and lost their place. They were not given less time and were not told about the comparison."),
    ],
  },
];

// Format coverage: the engine also supports match and short-answer questions; these two examples are used in the level banks (see levels-*.ts).
export const FORMAT_EXAMPLES = { match, short, tf };
