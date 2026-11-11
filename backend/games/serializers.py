from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .catalog import KINDS, TAGS
from .models import Note
from .services import DRAWING_MAX_STROKES, STATES

Dict = dict[str, Any]


KIND_CHOICES = list(KINDS)
STATE_CHOICES = list(STATES)


class GivenAnswerSerializer(serializers.Serializer[Dict]):
    choice = serializers.IntegerField(allow_null=True)
    text = serializers.CharField(allow_blank=True)
    drawing = serializers.ListField(child=serializers.DictField())
    photo_url = serializers.CharField(allow_null=True)
    skipped = serializers.BooleanField()


class OptionSerializer(serializers.Serializer[Dict]):
    name = serializers.CharField()
    art = serializers.CharField(allow_null=True)


class ItemSerializer(serializers.Serializer[Dict]):
    id = serializers.CharField()
    text = serializers.CharField(allow_blank=True)
    options = OptionSerializer(many=True)
    mine = GivenAnswerSerializer(allow_null=True)
    partner_answered = serializers.BooleanField()
    theirs = GivenAnswerSerializer(allow_null=True, help_text="Only once I answered too.")
    match = serializers.BooleanField(allow_null=True)


class TagSerializer(serializers.Serializer[Dict]):
    slug = serializers.ChoiceField(choices=list(TAGS))
    name = serializers.CharField()


class PackSerializer(serializers.Serializer[Dict]):
    id = serializers.CharField()
    kind = serializers.ChoiceField(choices=KIND_CHOICES)
    kind_name = serializers.CharField()
    title = serializers.CharField()
    art = serializers.CharField()
    topics = serializers.ListField(child=serializers.CharField())
    tags = TagSerializer(many=True)
    adult = serializers.BooleanField()
    premium = serializers.BooleanField()
    locked = serializers.BooleanField()
    position = serializers.IntegerField()
    total = serializers.IntegerField()
    mine = serializers.IntegerField(help_text="Items I answered.")
    theirs = serializers.IntegerField(help_text="Items my partner answered.")
    state = serializers.ChoiceField(choices=STATE_CHOICES)
    similarity = serializers.IntegerField(allow_null=True)


class PackDetailSerializer(PackSerializer):
    mode = serializers.ChoiceField(choices=["choice", "text", "drawing", "photo"])
    items = ItemSerializer(many=True)


class PackListSerializer(serializers.Serializer[Dict]):
    packs = PackSerializer(many=True)
    adult_hidden = serializers.IntegerField(help_text="18+ packs hidden until both opt in.")


class TopicSerializer(serializers.Serializer[Dict]):
    slug = serializers.CharField()
    name = serializers.CharField()
    adult = serializers.BooleanField()
    locked = serializers.BooleanField()
    total = serializers.IntegerField()
    done = serializers.IntegerField()
    percent = serializers.IntegerField()


class KindSerializer(serializers.Serializer[Dict]):
    slug = serializers.CharField()
    name = serializers.CharField()
    total = serializers.IntegerField()


class AdultSerializer(serializers.Serializer[Dict]):
    mine = serializers.BooleanField()
    partner = serializers.BooleanField()


class StatsSerializer(serializers.Serializer[Dict]):
    days_together = serializers.IntegerField(allow_null=True)
    answered_percent = serializers.IntegerField()
    answered = serializers.IntegerField()
    memories = serializers.IntegerField()
    events = serializers.IntegerField()
    messages = serializers.IntegerField()
    notes = serializers.IntegerField()


class StreakSerializer(serializers.Serializer[Dict]):
    count = serializers.IntegerField(help_text="Days in a row you both played.")
    today_done = serializers.BooleanField()


class GamesHomeSerializer(serializers.Serializer[Dict]):
    daily = PackSerializer(many=True)
    your_turn = PackSerializer(many=True)
    your_turn_count = serializers.IntegerField()
    waiting_count = serializers.IntegerField()
    done_count = serializers.IntegerField()
    topics = TopicSerializer(many=True)
    kinds = KindSerializer(many=True)
    adult = AdultSerializer()
    stats = StatsSerializer()
    streak = StreakSerializer()


class AnswerInputSerializer(serializers.Serializer[Dict]):
    question = serializers.CharField(max_length=80)
    choice = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=9)
    text = serializers.CharField(required=False, allow_blank=True, max_length=600)
    drawing = serializers.ListField(
        child=serializers.DictField(), required=False, max_length=DRAWING_MAX_STROKES
    )
    media_key = serializers.CharField(required=False, allow_blank=True, max_length=512)
    skipped = serializers.BooleanField(required=False, default=False)


class AdultInputSerializer(serializers.Serializer[Dict]):
    enabled = serializers.BooleanField()


class NoteSerializer(serializers.ModelSerializer[Note]):
    author = serializers.SerializerMethodField()

    class Meta:
        model = Note
        fields = ["id", "text", "color", "author", "created_at"]
        read_only_fields = ["id", "author", "created_at"]

    @extend_schema_field(serializers.ChoiceField(choices=["me", "you"]))
    def get_author(self, obj: Note) -> str:
        request = self.context.get("request")
        return "me" if request is not None and obj.author_id == request.user.pk else "you"
