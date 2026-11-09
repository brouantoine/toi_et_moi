from rest_framework import serializers


class CitySerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.IntegerField()
    name = serializers.CharField(help_text='Spelling chosen or matched ("Londres").')
    country = serializers.CharField(help_text="ISO 3166-1 alpha-2 code.")


class MyCitySerializer(serializers.Serializer[dict[str, object]]):
    city = CitySerializer(allow_null=True)
    sharing = serializers.BooleanField()


class PartnerCitySerializer(serializers.Serializer[dict[str, object]]):
    sharing = serializers.BooleanField()
    city = CitySerializer(allow_null=True, help_text="Only when both of you share.")


class DistanceSerializer(serializers.Serializer[dict[str, object]]):
    mine = MyCitySerializer()
    partner = PartnerCitySerializer()
    km = serializers.IntegerField(
        allow_null=True, help_text="Rounded; 0 means the same city. Null unless both share."
    )


class DistanceInputSerializer(serializers.Serializer[dict[str, object]]):
    city_id = serializers.IntegerField(allow_null=True, min_value=1)
    name = serializers.CharField(required=False, allow_blank=True, max_length=80)
    sharing = serializers.BooleanField()
