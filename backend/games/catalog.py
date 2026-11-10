"""Questions and games catalogue (fr/en), kept in code: reviewed, versioned, testable.

A question belongs to one TOPIC (what it is about) and one KIND (how it is played).
Ids are stable ("travel-1"): answers reference them, so never renumber, only append.
"""

from __future__ import annotations

from dataclasses import dataclass

FIXED_OPTIONS: dict[str, dict[str, tuple[str, str]]] = {
    "agree": {"fr": ("D’accord", "Pas d’accord"), "en": ("Agree", "Disagree")},
    "never": {"fr": ("Je l’ai déjà fait", "Jamais"), "en": ("I have", "Never")},
    # Stored from the answerer's point of view: 0 = me, 1 = my partner.
    "most_likely": {"fr": ("Moi", "Toi"), "en": ("Me", "You")},
}

#: slug -> (fr, en). Order is the display order.
KINDS: dict[str, tuple[str, str]] = {
    "this_or_that": ("Ça ou ça ?", "This or that?"),
    "agree": ("D’accord / Pas d’accord", "Agree / Disagree"),
    "never": ("Je n’ai jamais", "Never have I ever"),
    "rather": ("Tu préfères ?", "Would you rather?"),
    "most_likely": ("Qui est le plus ?", "Who is most likely?"),
    "conversation": ("Conversations profondes", "Deep talks"),
}

#: slug -> (fr, en, adults only)
TOPICS: dict[str, tuple[str, str, bool]] = {
    "warmup": ("Échauffement", "Warm-up", False),
    "relationship": ("Relation", "Relationship", False),
    "intimacy": ("Sexe et amour", "Sex and love", True),
    "food": ("Cuisine et boissons", "Food and drinks", False),
    "money": ("Argent", "Money", False),
    "knowyou": ("Apprends à te connaître", "Getting to know you", False),
    "travel": ("Voyage", "Travel", False),
    "family": ("Famille et maison", "Family and home", False),
    "hobbies": ("Loisirs et passions", "Hobbies and passions", False),
    "work": ("Travail et études", "Work and studies", False),
    "lifestyle": ("Mode de vie", "Lifestyle", False),
    "values": ("Valeurs", "Values", False),
    "future": ("Avenir et engagement", "Future and commitment", False),
    "us": ("Notre histoire", "Our story", False),
    "fun": ("Pour rire", "Just for fun", False),
}

# topic | kind | fr | en | fr options (a/b) | en options (a/b)   — options only when free.
_RAW = """
warmup|this_or_that|Plutôt matin ou plutôt soir ?|Morning person or night owl?|Matin/Soir|Morning/Night
warmup|this_or_that|Plage ou montagne ?|Beach or mountains?|Plage/Montagne|Beach/Mountains
warmup|rather|Tu préfères un message vocal ou un long texto ?|Would you rather get a voice note or a long text?|Message vocal/Long texto|Voice note/Long text
warmup|most_likely|Qui s’endort en premier devant un film ?|Who falls asleep first during a film?||
warmup|never|Je n’ai jamais chanté à tue-tête sous la douche.|Never have I ever sung at the top of my lungs in the shower.||
warmup|conversation|Quel est ton plus beau souvenir de nous deux ?|What is your favourite memory of the two of us?||
relationship|agree|Dans un couple, il faut tout se dire.|In a couple, you should tell each other everything.||
relationship|agree|Se disputer de temps en temps, c’est sain.|Arguing from time to time is healthy.||
relationship|most_likely|Qui fait le premier pas après une dispute ?|Who makes the first move after an argument?||
relationship|rather|Tu préfères une soirée surprise ou une soirée préparée ensemble ?|Would you rather have a surprise evening or plan it together?|Surprise/Préparée ensemble|Surprise/Planned together
relationship|conversation|Qu’est-ce qui te fait te sentir aimé·e au quotidien ?|What makes you feel loved day to day?||
relationship|conversation|Quel petit geste de moi te touche le plus ?|Which little thing I do touches you most?||
intimacy|agree|On devrait parler plus souvent de nos envies.|We should talk about our desires more often.||
intimacy|this_or_that|Plutôt tendresse ou plutôt passion ?|More tenderness or more passion?|Tendresse/Passion|Tenderness/Passion
intimacy|rather|Tu préfères une soirée improvisée ou un rendez-vous prévu ?|Would you rather a spontaneous evening or a planned date night?|Improvisée/Prévue|Spontaneous/Planned
intimacy|most_likely|Qui prend le plus souvent l’initiative ?|Who takes the lead most often?||
intimacy|never|Je n’ai jamais envoyé un message coquin par erreur.|Never have I ever sent a flirty message by mistake.||
intimacy|conversation|Qu’est-ce qui te fait te sentir désiré·e ?|What makes you feel desired?||
food|this_or_that|Sucré ou salé ?|Sweet or savoury?|Sucré/Salé|Sweet/Savoury
food|this_or_that|Cuisiner à la maison ou manger dehors ?|Cook at home or eat out?|À la maison/Dehors|At home/Out
food|most_likely|Qui cuisine le mieux ?|Who is the better cook?||
food|never|Je n’ai jamais mangé le dessert de l’autre en cachette.|Never have I ever secretly eaten my partner's dessert.||
food|rather|Tu préfères un grand petit-déjeuner ou un dîner aux chandelles ?|Would you rather a big breakfast or a candlelit dinner?|Petit-déjeuner/Dîner|Breakfast/Dinner
food|conversation|Quel plat te rappelle ton enfance ?|Which dish reminds you of your childhood?||
money|agree|Un couple devrait avoir un compte commun.|A couple should have a joint account.||
money|agree|Il faut se consulter avant un gros achat.|We should check with each other before a big purchase.||
money|this_or_that|Plutôt économe ou plutôt dépensier ?|More of a saver or a spender?|Économe/Dépensier|Saver/Spender
money|most_likely|Qui craque le plus facilement en magasin ?|Who gives in most easily while shopping?||
money|rather|Tu préfères un beau voyage ou un achat qui dure ?|Would you rather a great trip or something that lasts?|Voyage/Achat qui dure|Trip/Lasting purchase
money|conversation|Pour quel projet aimerais-tu qu’on épargne ensemble ?|What would you like us to save for together?||
knowyou|conversation|Qu’est-ce qui te rend fier·e de toi cette année ?|What are you proud of this year?||
knowyou|conversation|Quelle peur aimerais-tu dépasser ?|Which fear would you like to overcome?||
knowyou|this_or_that|Plutôt introverti·e ou extraverti·e ?|More introvert or extrovert?|Introverti·e/Extraverti·e|Introvert/Extrovert
knowyou|never|Je n’ai jamais pleuré devant un dessin animé.|Never have I ever cried at a cartoon.||
knowyou|agree|J’ai besoin de temps seul·e pour me ressourcer.|I need time alone to recharge.||
knowyou|most_likely|Qui garde le mieux un secret ?|Who is better at keeping a secret?||
travel|this_or_that|Voyage organisé ou à l’aventure ?|Planned trip or adventure?|Organisé/À l’aventure|Planned/Adventure
travel|this_or_that|Grande ville ou nature ?|Big city or nature?|Grande ville/Nature|Big city/Nature
travel|most_likely|Qui oublie toujours quelque chose dans la valise ?|Who always forgets something when packing?||
travel|never|Je n’ai jamais raté un avion ou un car.|Never have I ever missed a flight or a coach.||
travel|rather|Tu préfères un week-end tout près ou un long voyage loin ?|Would you rather a weekend nearby or a long trip far away?|Week-end tout près/Long voyage|Weekend nearby/Long trip
travel|conversation|Quelle destination rêves-tu de découvrir avec moi ?|Which place do you dream of discovering with me?||
family|agree|Les tâches de la maison doivent être partagées à égalité.|Household chores should be shared equally.||
family|this_or_that|Appartement en ville ou maison avec jardin ?|City flat or house with a garden?|Appartement/Maison|Flat/House
family|most_likely|Qui range le plus ?|Who tidies up more?||
family|rather|Tu préfères recevoir à la maison ou sortir chez les autres ?|Would you rather host at home or go to other people's?|Recevoir/Sortir|Host/Go out
family|conversation|Quelle tradition de ta famille aimerais-tu garder ?|Which family tradition would you like to keep?||
family|conversation|À quoi ressemble la maison de tes rêves ?|What does your dream home look like?||
hobbies|this_or_that|Film ou série ?|Film or series?|Film/Série|Film/Series
hobbies|this_or_that|Sport ou canapé ?|Workout or sofa?|Sport/Canapé|Workout/Sofa
hobbies|most_likely|Qui danse le mieux ?|Who is the better dancer?||
hobbies|never|Je n’ai jamais abandonné un loisir au bout d’une semaine.|Never have I ever dropped a hobby after a week.||
hobbies|rather|Tu préfères apprendre un instrument ou une langue ?|Would you rather learn an instrument or a language?|Instrument/Langue|Instrument/Language
hobbies|conversation|Quelle activité aimerais-tu qu’on essaie ensemble ?|Which activity would you like us to try together?||
work|agree|Le travail ne doit pas s’inviter à table.|Work should stay away from the dinner table.||
work|this_or_that|Plutôt salarié·e ou à ton compte ?|Employee or self-employed?|Salarié·e/À mon compte|Employee/Self-employed
work|most_likely|Qui travaille le plus tard le soir ?|Who works latest in the evening?||
work|rather|Tu préfères un métier passion ou un métier bien payé ?|Would you rather a job you love or a job that pays well?|Passion/Bien payé|Passion/Well paid
work|conversation|Quel métier rêvais-tu de faire enfant ?|What did you dream of becoming as a child?||
work|conversation|Comment puis-je mieux te soutenir dans tes projets ?|How can I support you better in your projects?||
lifestyle|this_or_that|Lève-tôt le week-end ou grasse matinée ?|Early weekend start or lie-in?|Lève-tôt/Grasse matinée|Early start/Lie-in
lifestyle|this_or_that|Tout prévoir ou improviser ?|Plan everything or improvise?|Prévoir/Improviser|Plan/Improvise
lifestyle|most_likely|Qui passe le plus de temps sur son téléphone ?|Who spends more time on their phone?||
lifestyle|never|Je n’ai jamais fait semblant d’aimer un cadeau.|Never have I ever pretended to like a gift.||
lifestyle|agree|Une soirée sans écran par semaine nous ferait du bien.|One screen-free evening a week would do us good.||
lifestyle|conversation|À quoi ressemble ta journée idéale ?|What does your ideal day look like?||
values|agree|On peut s’aimer sans être d’accord sur tout.|You can love each other without agreeing on everything.||
values|agree|La famille passe avant le travail.|Family comes before work.||
values|rather|Tu préfères avoir raison ou avoir la paix ?|Would you rather be right or have peace?|Avoir raison/Avoir la paix|Be right/Have peace
values|most_likely|Qui pardonne le plus vite ?|Who forgives faster?||
values|conversation|Quelle valeur veux-tu absolument transmettre ?|Which value do you absolutely want to pass on?||
values|conversation|Qu’est-ce qui compte le plus pour toi dans la vie ?|What matters most to you in life?||
warmup|this_or_that|Café ou thé ?|Coffee or tea?|Café/Thé|Coffee/Tea
warmup|this_or_that|Chien ou chat ?|Dog or cat?|Chien/Chat|Dog/Cat
warmup|this_or_that|Pizza ou burger ?|Pizza or burger?|Pizza/Burger|Pizza/Burger
warmup|this_or_that|Été ou hiver ?|Summer or winter?|Été/Hiver|Summer/Winter
warmup|rather|Tu préfères pouvoir voler ou être invisible ?|Would you rather be able to fly or be invisible?|Voler/Être invisible|Fly/Be invisible
warmup|rather|Tu préfères revivre notre premier rendez-vous ou découvrir notre futur ?|Would you rather relive our first date or see our future?|Revivre le premier rendez-vous/Voir notre futur|Relive our first date/See our future
warmup|most_likely|Qui chante le plus faux ?|Who sings most out of tune?||
warmup|most_likely|Qui est le plus en retard ?|Who is more often late?||
warmup|most_likely|Qui rit le plus à ses propres blagues ?|Who laughs most at their own jokes?||
warmup|never|Je n’ai jamais fait semblant de connaître une chanson.|Never have I ever pretended to know a song.||
warmup|never|Je n’ai jamais parlé tout seul dans la rue.|Never have I ever talked to myself in the street.||
warmup|agree|Un bon film vaut mieux qu’une bonne série.|A good film beats a good series.||
warmup|conversation|Quelle chanson te fait penser à nous ?|Which song makes you think of us?||
warmup|conversation|Quel est le dernier moment où tu as vraiment ri ?|When did you last really laugh?||
relationship|agree|Chacun a besoin de garder des amis à soi.|Each of us needs to keep friends of our own.||
relationship|agree|On ne devrait jamais aller se coucher fâchés.|We should never go to bed angry.||
relationship|agree|La jalousie, un peu, c’est une preuve d’amour.|A little jealousy is a sign of love.||
relationship|this_or_that|Plutôt mots doux ou petits gestes ?|More sweet words or small gestures?|Mots doux/Petits gestes|Sweet words/Small gestures
relationship|this_or_that|Après une dispute : parler tout de suite ou laisser retomber ?|After an argument: talk right away or let it cool down?|Tout de suite/Laisser retomber|Right away/Let it cool down
relationship|rather|Tu préfères un câlin ou un long message d’amour ?|Would you rather get a hug or a long love message?|Un câlin/Un long message|A hug/A long message
relationship|rather|Tu préfères une surprise par mois ou un grand voyage par an ?|Would you rather a surprise every month or a big trip every year?|Une surprise par mois/Un grand voyage par an|A monthly surprise/A yearly big trip
relationship|most_likely|Qui dit « je t’aime » le plus souvent ?|Who says “I love you” more often?||
relationship|most_likely|Qui se souvient le mieux de nos dates importantes ?|Who remembers our important dates best?||
relationship|most_likely|Qui boude le plus longtemps ?|Who sulks the longest?||
relationship|never|Je n’ai jamais relu nos anciens messages.|Never have I ever reread our old messages.||
relationship|conversation|Quand t’es-tu senti·e le plus proche de moi ?|When did you feel closest to me?||
relationship|conversation|Qu’est-ce que j’ai fait récemment qui t’a fait du bien ?|What did I do recently that made you feel good?||
relationship|conversation|De quoi as-tu besoin quand tu passes une mauvaise journée ?|What do you need when you are having a bad day?||
intimacy|agree|La tendresse au quotidien compte autant que les grands moments.|Everyday tenderness matters as much as the big moments.||
intimacy|agree|Il faut savoir se surprendre, même après des années.|We should keep surprising each other, even after years.||
intimacy|this_or_that|Plutôt matin ou plutôt soir pour les câlins ?|Mornings or evenings for cuddles?|Matin/Soir|Morning/Evening
intimacy|this_or_that|Lumière tamisée ou noir complet ?|Dim light or total darkness?|Lumière tamisée/Noir complet|Dim light/Total darkness
intimacy|rather|Tu préfères un massage ou un bain à deux ?|Would you rather a massage or a bath together?|Un massage/Un bain à deux|A massage/A bath together
intimacy|rather|Tu préfères un week-end en amoureux ou une nuit à l’hôtel en ville ?|Would you rather a romantic weekend away or a night in a city hotel?|Week-end en amoureux/Nuit à l’hôtel|Romantic weekend/Hotel night
intimacy|most_likely|Qui envoie les messages les plus coquins ?|Who sends the flirtiest messages?||
intimacy|most_likely|Qui est le plus câlin ?|Who is the cuddliest?||
intimacy|never|Je n’ai jamais pensé à toi toute une journée de travail.|Never have I ever thought of you a whole working day.||
intimacy|never|Je n’ai jamais rougi à cause d’un de tes messages.|Never have I ever blushed because of one of your messages.||
intimacy|conversation|Quel moment intime avec moi gardes-tu en tête ?|Which intimate moment with me do you keep in mind?||
intimacy|conversation|Qu’aimerais-tu qu’on essaie ensemble ?|What would you like us to try together?||
intimacy|conversation|Quel geste de ma part te fait craquer ?|Which gesture of mine melts you?||
intimacy|conversation|Comment aimes-tu qu’on te dise qu’on a envie de toi ?|How do you like to be told that someone wants you?||
food|this_or_that|Restaurant chic ou street food ?|Fancy restaurant or street food?|Restaurant chic/Street food|Fancy restaurant/Street food
food|this_or_that|Épicé ou doux ?|Spicy or mild?|Épicé/Doux|Spicy/Mild
food|this_or_that|Petit-déjeuner au lit ou brunch dehors ?|Breakfast in bed or brunch out?|Au lit/Brunch dehors|In bed/Brunch out
food|rather|Tu préfères ne plus jamais manger de chocolat ou de fromage ?|Would you rather never eat chocolate or cheese again?|Plus de chocolat/Plus de fromage|No more chocolate/No more cheese
food|rather|Tu préfères cuisiner ensemble ou que l’autre cuisine pour toi ?|Would you rather cook together or have your partner cook for you?|Cuisiner ensemble/Qu’on cuisine pour moi|Cook together/Be cooked for
food|most_likely|Qui mange le plus vite ?|Who eats faster?||
food|most_likely|Qui commande toujours la même chose ?|Who always orders the same thing?||
food|most_likely|Qui grignote la nuit ?|Who snacks at night?||
food|never|Je n’ai jamais goûté un plat que je ne connaissais pas du tout en voyage.|Never have I ever tried a totally unknown dish while travelling.||
food|never|Je n’ai jamais raté une recette au point de tout jeter.|Never have I ever ruined a recipe so badly I threw it all away.||
food|agree|On devrait avoir un plat signature à nous deux.|We should have a signature dish of our own.||
food|agree|Le dîner se prend sans téléphone sur la table.|Dinner should be eaten with no phones on the table.||
food|conversation|Quel repas avec moi n’oublieras-tu jamais ?|Which meal with me will you never forget?||
food|conversation|Quel plat de ton pays ou de ta famille veux-tu me faire découvrir ?|Which dish from your country or family do you want me to discover?||
money|agree|Chacun devrait garder un peu d’argent à soi.|Each of us should keep some money of our own.||
money|agree|On devrait payer les dépenses communes au prorata de nos revenus.|We should share common costs in proportion to our incomes.||
money|agree|Aider financièrement la famille, c’est normal.|Helping family financially is normal.||
money|this_or_that|Un budget précis ou au feeling ?|A precise budget or going with the flow?|Budget précis/Au feeling|Precise budget/Go with the flow
money|this_or_that|Louer ou acheter ?|Rent or buy?|Louer/Acheter|Rent/Buy
money|rather|Tu préfères gagner plus en travaillant plus, ou gagner moins avec plus de temps libre ?|Would you rather earn more working more, or earn less with more free time?|Gagner plus/Plus de temps libre|Earn more/More free time
money|rather|Tu préfères économiser pour une maison ou pour des voyages ?|Would you rather save for a house or for travelling?|Une maison/Des voyages|A house/Travelling
money|most_likely|Qui gère le mieux l’argent ?|Who manages money better?||
money|most_likely|Qui ferait un achat sur un coup de tête ?|Who would buy something on impulse?||
money|never|Je n’ai jamais caché un achat à quelqu’un.|Never have I ever hidden a purchase from someone.||
money|never|Je n’ai jamais prêté de l’argent sans le revoir.|Never have I ever lent money and never seen it again.||
money|conversation|Qu’est-ce que l’argent représente pour toi : sécurité, liberté, plaisir ?|What does money mean to you: safety, freedom, pleasure?||
money|conversation|Comment parlait-on d’argent chez toi quand tu étais petit·e ?|How was money talked about at home when you were little?||
money|conversation|Quel serait ton plus grand rêve si l’argent n’était pas un problème ?|What would be your biggest dream if money were no issue?||
knowyou|conversation|Quel est ton plus beau souvenir d’enfance ?|What is your favourite childhood memory?||
knowyou|conversation|Qui t’a le plus influencé·e dans la vie ?|Who has influenced you most in life?||
knowyou|conversation|Si tu pouvais dîner avec n’importe qui, qui choisirais-tu ?|If you could have dinner with anyone, who would you choose?||
knowyou|conversation|Qu’est-ce qui te fait te sentir vraiment toi-même ?|What makes you feel truly yourself?||
knowyou|conversation|De quoi es-tu le plus reconnaissant·e aujourd’hui ?|What are you most grateful for today?||
knowyou|conversation|Quel conseil donnerais-tu à toi-même à 15 ans ?|What advice would you give yourself at 15?||
knowyou|this_or_that|Plutôt tête ou plutôt cœur ?|More head or more heart?|Tête/Cœur|Head/Heart
knowyou|this_or_that|Plutôt organisé·e ou spontané·e ?|More organised or spontaneous?|Organisé·e/Spontané·e|Organised/Spontaneous
knowyou|rather|Tu préfères être célèbre ou anonyme et heureux·se ?|Would you rather be famous or anonymous and happy?|Célèbre/Anonyme et heureux·se|Famous/Anonymous and happy
knowyou|rather|Tu préfères connaître ton avenir ou garder la surprise ?|Would you rather know your future or keep the surprise?|Connaître l’avenir/Garder la surprise|Know the future/Keep the surprise
knowyou|most_likely|Qui pleure devant un film ?|Who cries at films?||
knowyou|most_likely|Qui se fait des amis le plus facilement ?|Who makes friends more easily?||
knowyou|never|Je n’ai jamais eu peur du noir adulte.|Never have I ever been scared of the dark as an adult.||
knowyou|agree|On change beaucoup en vieillissant.|People change a lot as they get older.||
travel|this_or_that|Avion ou train ?|Plane or train?|Avion/Train|Plane/Train
travel|this_or_that|Hôtel ou camping ?|Hotel or camping?|Hôtel/Camping|Hotel/Camping
travel|this_or_that|Valise légère ou on emporte tout ?|Pack light or take everything?|Valise légère/On emporte tout|Pack light/Take everything
travel|rather|Tu préfères faire le tour du monde en un an ou un voyage par an toute la vie ?|Would you rather go round the world in a year or take one trip a year for life?|Le tour du monde/Un voyage par an|Round the world/One trip a year
travel|rather|Tu préfères un road trip ou un séjour au même endroit ?|Would you rather a road trip or stay in one place?|Road trip/Un seul endroit|Road trip/One place
travel|most_likely|Qui se perd le plus facilement ?|Who gets lost more easily?||
travel|most_likely|Qui planifie tout le voyage ?|Who plans the whole trip?||
travel|most_likely|Qui ramène le plus de souvenirs ?|Who brings back the most souvenirs?||
travel|never|Je n’ai jamais voyagé seul·e.|Never have I ever travelled alone.||
travel|never|Je n’ai jamais dormi dans un aéroport.|Never have I ever slept in an airport.||
travel|agree|Les meilleurs voyages sont ceux qu’on ne prévoit pas.|The best trips are the unplanned ones.||
travel|agree|Il faut visiter le pays d’origine de l’autre ensemble.|We should visit each other’s home country together.||
travel|conversation|Quel est le plus bel endroit que tu aies vu ?|What is the most beautiful place you have seen?||
travel|conversation|Quel voyage avec moi referais-tu demain ?|Which trip with me would you do again tomorrow?||
family|agree|Les grands-parents devraient beaucoup s’occuper des petits-enfants.|Grandparents should be very involved with the grandchildren.||
family|agree|Recevoir la famille à la maison souvent, c’est important.|Hosting family at home often is important.||
family|agree|Les décisions de la maison se prennent toujours à deux.|Household decisions are always made together.||
family|this_or_that|Grande famille ou petit noyau ?|Big family or small circle?|Grande famille/Petit noyau|Big family/Small circle
family|this_or_that|Vivre en ville ou à la campagne ?|Live in the city or the countryside?|Ville/Campagne|City/Countryside
family|rather|Tu préfères vivre près de ta famille ou loin de tout ?|Would you rather live near your family or far from everything?|Près de la famille/Loin de tout|Near family/Far away
family|rather|Tu préfères un grand repas de famille ou une soirée à deux ?|Would you rather a big family meal or an evening for two?|Repas de famille/Soirée à deux|Family meal/Evening for two
family|most_likely|Qui ferait le parent le plus strict ?|Who would be the stricter parent?||
family|most_likely|Qui oublie de sortir les poubelles ?|Who forgets to take out the bins?||
family|most_likely|Qui décore le plus la maison ?|Who decorates the home more?||
family|never|Je n’ai jamais eu de dispute pour une tâche ménagère.|Never have I ever argued over a household chore.||
family|conversation|Que veux-tu reproduire de la famille où tu as grandi ?|What do you want to repeat from the family you grew up in?||
family|conversation|Que ne veux-tu surtout pas reproduire ?|What do you really not want to repeat?||
family|conversation|Quelle place doivent avoir nos familles dans notre couple ?|What place should our families have in our relationship?||
hobbies|this_or_that|Lecture ou musique ?|Reading or music?|Lecture/Musique|Reading/Music
hobbies|this_or_that|Concert ou cinéma ?|Concert or cinema?|Concert/Cinéma|Concert/Cinema
hobbies|this_or_that|Jeux de société ou jeux vidéo ?|Board games or video games?|Jeux de société/Jeux vidéo|Board games/Video games
hobbies|rather|Tu préfères une journée à la plage ou une randonnée en montagne ?|Would you rather a day at the beach or a mountain hike?|Plage/Randonnée|Beach/Hike
hobbies|rather|Tu préfères apprendre à danser ou à cuisiner ensemble ?|Would you rather learn to dance or to cook together?|Danser/Cuisiner|Dance/Cook
hobbies|most_likely|Qui gagne toujours aux jeux ?|Who always wins at games?||
hobbies|most_likely|Qui abandonne un livre en cours de route ?|Who gives up on a book halfway?||
hobbies|most_likely|Qui passerait sa journée sur le canapé ?|Who would spend the day on the sofa?||
hobbies|never|Je n’ai jamais triché à un jeu.|Never have I ever cheated at a game.||
hobbies|never|Je n’ai jamais regardé une saison entière en une nuit.|Never have I ever watched a whole season in one night.||
hobbies|agree|Chacun doit garder ses passions à lui.|Each of us should keep our own passions.||
hobbies|agree|Un week-end sans rien prévoir, c’est parfait.|A weekend with nothing planned is perfect.||
hobbies|conversation|Quelle passion aimerais-tu me transmettre ?|Which passion would you like to share with me?||
hobbies|conversation|Quel talent caché as-tu ?|What hidden talent do you have?||
work|agree|On peut être heureux sans aimer son travail.|You can be happy without loving your job.||
work|agree|Il faut déménager si l’un de nous a une belle opportunité.|We should move if one of us gets a great opportunity.||
work|this_or_that|Télétravail ou bureau ?|Remote work or office?|Télétravail/Bureau|Remote/Office
work|this_or_that|Sécurité ou aventure professionnelle ?|Job security or professional adventure?|Sécurité/Aventure|Security/Adventure
work|rather|Tu préfères un patron difficile et un super salaire, ou l’inverse ?|Would you rather a tough boss and a great salary, or the opposite?|Patron difficile et gros salaire/L’inverse|Tough boss, great pay/The opposite
work|rather|Tu préfères reprendre des études ou créer ton entreprise ?|Would you rather go back to studying or start your own business?|Reprendre des études/Créer une entreprise|Study again/Start a business
work|most_likely|Qui répond aux mails le week-end ?|Who answers emails at the weekend?||
work|most_likely|Qui changera de métier un jour ?|Who will change careers one day?||
work|most_likely|Qui sera le premier à prendre sa retraite ?|Who will retire first?||
work|never|Je n’ai jamais fait semblant d’être malade pour ne pas aller travailler.|Never have I ever faked being ill to skip work.||
work|never|Je n’ai jamais pleuré au travail.|Never have I ever cried at work.||
work|conversation|De quoi es-tu le plus fier·e dans ton parcours ?|What are you proudest of in your career?||
work|conversation|À quoi ressemblerait ta vie professionnelle idéale dans dix ans ?|What would your ideal working life look like in ten years?||
work|conversation|Qu’est-ce qui te stresse le plus au travail en ce moment ?|What stresses you most at work right now?||
lifestyle|this_or_that|Sport le matin ou le soir ?|Workout in the morning or evening?|Matin/Soir|Morning/Evening
lifestyle|this_or_that|Maison rangée ou désordre créatif ?|Tidy home or creative mess?|Rangée/Désordre créatif|Tidy/Creative mess
lifestyle|this_or_that|Sortir ou rester à la maison le samedi soir ?|Go out or stay in on Saturday night?|Sortir/Rester|Go out/Stay in
lifestyle|rather|Tu préfères te coucher tôt ou faire la fête jusqu’au matin ?|Would you rather go to bed early or party till morning?|Me coucher tôt/Faire la fête|Early night/Party all night
lifestyle|rather|Tu préfères une semaine sans téléphone ou sans sucre ?|Would you rather a week without your phone or without sugar?|Sans téléphone/Sans sucre|No phone/No sugar
lifestyle|most_likely|Qui ronfle le plus ?|Who snores more?||
lifestyle|most_likely|Qui prend le plus de temps à se préparer ?|Who takes longer to get ready?||
lifestyle|most_likely|Qui oublie toujours ses clés ?|Who always forgets their keys?||
lifestyle|never|Je n’ai jamais dormi plus de douze heures d’affilée.|Never have I ever slept more than twelve hours straight.||
lifestyle|agree|On devrait avoir une routine du soir à deux.|We should have an evening routine together.||
lifestyle|agree|Les amis peuvent passer à l’improviste.|Friends can drop by unannounced.||
lifestyle|conversation|Quelle habitude aimerais-tu qu’on prenne ensemble ?|Which habit would you like us to start together?||
lifestyle|conversation|Qu’est-ce qui te ressource vraiment ?|What really recharges you?||
lifestyle|conversation|Quelle petite chose rendrait notre quotidien plus doux ?|What small thing would make our daily life softer?||
values|agree|La fidélité, c’est aussi ne pas mentir par omission.|Faithfulness also means not lying by omission.||
values|agree|La religion ou la spiritualité doivent avoir une place dans notre foyer.|Religion or spirituality should have a place in our home.||
values|agree|On doit toujours dire la vérité, même quand elle fait mal.|We should always tell the truth, even when it hurts.||
values|this_or_that|Pardonner ou oublier ?|Forgive or forget?|Pardonner/Oublier|Forgive/Forget
values|this_or_that|Liberté ou sécurité ?|Freedom or security?|Liberté/Sécurité|Freedom/Security
values|rather|Tu préfères une vie simple et calme ou une vie intense et imprévisible ?|Would you rather a simple, calm life or an intense, unpredictable one?|Simple et calme/Intense et imprévisible|Simple and calm/Intense and unpredictable
values|rather|Tu préfères être respecté·e ou être aimé·e ?|Would you rather be respected or be loved?|Respecté·e/Aimé·e|Respected/Loved
values|most_likely|Qui défend les autres avec le plus d’énergie ?|Who stands up for others most fiercely?||
values|most_likely|Qui s’engagerait pour une cause ?|Who would commit to a cause?||
values|never|Je n’ai jamais menti pour protéger quelqu’un.|Never have I ever lied to protect someone.||
values|never|Je n’ai jamais changé d’avis sur une grande question de la vie.|Never have I ever changed my mind about a big life question.||
values|conversation|Quelle est ta définition d’une vie réussie ?|What is your definition of a successful life?||
values|conversation|Qu’est-ce qui ne se négocie pas pour toi dans un couple ?|What is non-negotiable for you in a relationship?||
values|conversation|De quoi veux-tu qu’on se souvienne de toi ?|What do you want to be remembered for?||
future|agree|Le mariage change quelque chose dans un couple.|Marriage changes something in a relationship.||
future|agree|On devrait vivre ensemble avant de se marier.|We should live together before getting married.||
future|agree|Un contrat de mariage, c’est une bonne idée.|A prenuptial agreement is a good idea.||
future|agree|Les deux parents doivent pouvoir garder leur carrière.|Both parents should be able to keep their careers.||
future|this_or_that|Grand mariage ou petite cérémonie ?|Big wedding or small ceremony?|Grand mariage/Petite cérémonie|Big wedding/Small ceremony
future|this_or_that|Des enfants tôt ou plus tard ?|Children early or later?|Tôt/Plus tard|Early/Later
future|this_or_that|Rester ici ou partir vivre ailleurs ?|Stay here or move abroad?|Rester ici/Partir ailleurs|Stay here/Move abroad
future|rather|Tu préfères deux enfants ou une grande famille ?|Would you rather have two children or a big family?|Deux enfants/Une grande famille|Two children/A big family
future|rather|Tu préfères une maison à rénover ou une maison neuve ?|Would you rather a house to renovate or a new one?|À rénover/Neuve|To renovate/New
future|most_likely|Qui sera le plus gâteau avec les enfants ?|Who will spoil the kids more?||
future|most_likely|Qui organisera notre mariage ?|Who will organise our wedding?||
future|never|Je n’ai jamais imaginé le prénom de nos enfants.|Never have I ever imagined our children’s names.||
future|conversation|Où nous vois-tu dans cinq ans ?|Where do you see us in five years?||
future|conversation|Comment voudrais-tu qu’on élève nos enfants ?|How would you like us to raise our children?||
future|conversation|Comment veux-tu qu’on gère nos désaccords quand ils sont importants ?|How do you want us to handle our big disagreements?||
future|conversation|Qu’est-ce qui te ferait dire oui pour la vie ?|What would make you say yes for life?||
future|conversation|Quel rôle la foi aura-t-elle dans notre famille ?|What role will faith play in our family?||
future|conversation|Quel projet fou veux-tu qu’on réalise avant nos 60 ans ?|Which crazy project do you want us to do before we turn 60?||
us|conversation|Quelle a été ta première impression de moi ?|What was your first impression of me?||
us|conversation|À quel moment as-tu su que tu tenais à moi ?|When did you know you cared about me?||
us|conversation|Quel est ton souvenir préféré de notre premier mois ?|What is your favourite memory of our first month?||
us|conversation|Qu’est-ce qui t’a fait rire chez moi la première fois ?|What made you laugh about me the first time?||
us|conversation|Quelle épreuve nous a rendus plus forts ?|Which hardship made us stronger?||
us|conversation|Quel surnom m’aurais-tu donné au début ?|What nickname would you have given me at the start?||
us|conversation|Décris notre couple en trois mots.|Describe our relationship in three words.||
us|most_likely|Qui a fait le premier pas ?|Who made the first move?||
us|most_likely|Qui est tombé amoureux en premier ?|Who fell in love first?||
us|most_likely|Qui a envoyé le premier message ?|Who sent the first message?||
us|most_likely|Qui a dit « je t’aime » en premier ?|Who said “I love you” first?||
us|this_or_that|Notre plus beau moment : un voyage ou un moment simple à la maison ?|Our best moment: a trip or a simple moment at home?|Un voyage/Un moment à la maison|A trip/A moment at home
us|this_or_that|Coup de foudre ou amour qui a grandi doucement ?|Love at first sight or love that grew slowly?|Coup de foudre/Amour qui a grandi|At first sight/Grew slowly
us|agree|Nous sommes plus forts aujourd’hui qu’au début.|We are stronger today than at the start.||
us|agree|On se ressemble plus qu’on ne le pense.|We are more alike than we think.||
us|agree|On rit assez ensemble.|We laugh together enough.||
us|never|Je n’ai jamais regretté notre rencontre.|Never have I ever regretted meeting you.||
us|never|Je n’ai jamais gardé un ticket ou un objet de nos sorties.|Never have I ever kept a ticket or an object from our dates.||
us|rather|Tu préfères revivre notre premier baiser ou notre premier voyage ?|Would you rather relive our first kiss or our first trip?|Premier baiser/Premier voyage|First kiss/First trip
us|rather|Tu préfères un album photo de nous ou une vidéo souvenir ?|Would you rather a photo album of us or a memory video?|Album photo/Vidéo souvenir|Photo album/Memory video
fun|most_likely|Qui survivrait le plus longtemps sur une île déserte ?|Who would survive longest on a desert island?||
fun|most_likely|Qui deviendrait célèbre sur les réseaux ?|Who would become famous on social media?||
fun|most_likely|Qui se ferait arrêter pour une bêtise ?|Who would get arrested for something silly?||
fun|most_likely|Qui parle en dormant ?|Who talks in their sleep?||
fun|most_likely|Qui gagnerait à un jeu télévisé ?|Who would win a TV game show?||
fun|rather|Tu préfères parler aux animaux ou parler toutes les langues ?|Would you rather talk to animals or speak every language?|Parler aux animaux/Toutes les langues|Talk to animals/Every language
fun|rather|Tu préfères avoir un chef cuisinier ou un chauffeur à vie ?|Would you rather have a personal chef or a driver for life?|Un chef/Un chauffeur|A chef/A driver
fun|rather|Tu préfères vivre sans musique ou sans films ?|Would you rather live without music or without films?|Sans musique/Sans films|No music/No films
fun|rather|Tu préfères voyager dans le passé ou dans le futur ?|Would you rather travel to the past or the future?|Le passé/Le futur|The past/The future
fun|this_or_that|Super-héros ou méchant de film ?|Superhero or film villain?|Super-héros/Méchant|Superhero/Villain
fun|this_or_that|Karaoké ou piste de danse ?|Karaoke or dance floor?|Karaoké/Piste de danse|Karaoke/Dance floor
fun|this_or_that|Licorne ou dragon ?|Unicorn or dragon?|Licorne/Dragon|Unicorn/Dragon
fun|never|Je n’ai jamais dansé seul·e devant le miroir.|Never have I ever danced alone in front of the mirror.||
fun|never|Je n’ai jamais envoyé un message à la mauvaise personne.|Never have I ever sent a message to the wrong person.||
fun|never|Je n’ai jamais ri à un enterrement ou à un moment sérieux.|Never have I ever laughed at a funeral or a serious moment.||
fun|agree|L’ananas a sa place sur une pizza.|Pineapple belongs on pizza.||
fun|agree|On ferait un super duo dans un jeu télé.|We would make a great duo on a TV show.||
fun|conversation|Si on était un film, ce serait lequel ?|If we were a film, which one would we be?||
fun|conversation|Quelle super-pouvoir me donnerais-tu ?|Which superpower would you give me?||
fun|conversation|Si tu devais me décrire avec un animal, lequel ?|If you had to describe me as an animal, which one?||
"""


@dataclass(frozen=True, slots=True)
class Question:
    id: str
    topic: str
    kind: str
    fr: str
    en: str
    options_fr: tuple[str, ...]
    options_en: tuple[str, ...]

    @property
    def adult(self) -> bool:
        return TOPICS[self.topic][2]

    @property
    def free_text(self) -> bool:
        return self.kind == "conversation"

    def text(self, language: str) -> str:
        return self.en if language == "en" else self.fr

    def options(self, language: str) -> tuple[str, ...]:
        return self.options_en if language == "en" else self.options_fr


def _load() -> dict[str, Question]:
    questions: dict[str, Question] = {}
    counters: dict[str, int] = {}
    for line in _RAW.strip().splitlines():
        topic, kind, fr, en, options_fr, options_en = line.split("|")
        counters[topic] = counters.get(topic, 0) + 1
        fr_options: tuple[str, ...]
        en_options: tuple[str, ...]
        if kind in FIXED_OPTIONS:
            fr_options, en_options = FIXED_OPTIONS[kind]["fr"], FIXED_OPTIONS[kind]["en"]
        elif kind == "conversation":
            fr_options = en_options = ()
        else:
            fr_options, en_options = tuple(options_fr.split("/")), tuple(options_en.split("/"))
        question = Question(
            f"{topic}-{counters[topic]}", topic, kind, fr, en, fr_options, en_options
        )
        questions[question.id] = question
    return questions


QUESTIONS: dict[str, Question] = _load()
