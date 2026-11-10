from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Note

Dict = dict[str, Any]


class GivenAnswerSerializer(serializers.Serializer[Dict]):
    choice = serializers.IntegerField(allow_null=True)
    text = serializers.CharField(allow_blank=True)


class QuestionSerializer(serializers.Serializer[Dict]):
    id = serializers.CharField()
    topic = serializers.CharField()
    kind = serializers.ChoiceField(
        choices=["this_or_that", "agree", "never", "rather", "most_likely", "conversation"]
    )
    text = serializers.CharField()
    options = serializers.ListField(child=serializers.CharField())
    adult = serializers.BooleanField()
    state = serializers.ChoiceField(choices=["new", "your_turn", "waiting", "done"])
    mine = GivenAnswerSerializer(allow_null=True)
    theirs = GivenAnswerSerializer(allow_null=True, help_text="Only once I answered too.")
    match = serializers.BooleanField(allow_null=True)


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


class GamesHomeSerializer(serializers.Serializer[Dict]):
    daily = QuestionSerializer(many=True)
    your_turn = QuestionSerializer(many=True)
    your_turn_count = serializers.IntegerField()
    topics = TopicSerializer(many=True)
    kinds = KindSerializer(many=True)
    adult = AdultSerializer()
    stats = StatsSerializer()


class AnswerInputSerializer(serializers.Serializer[Dict]):
    question = serializers.CharField(max_length=40)
    choice = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=9)
    text = serializers.CharField(required=False, allow_blank=True, max_length=600)


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
