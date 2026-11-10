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
