from rest_framework import serializers


class CitySerializer(serializers.Serializer[dict[str, object]]):
    name = serializers.CharField()
    country = serializers.CharField(help_text="ISO 3166-1 alpha-2 code.")


class PositionSerializer(serializers.Serializer[dict[str, object]]):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    located_at = serializers.DateTimeField()


class MyLocationSerializer(serializers.Serializer[dict[str, object]]):
    consented = serializers.BooleanField(help_text="Current terms accepted.")
    sharing = serializers.BooleanField(help_text="A position has been shared.")
    city = CitySerializer(allow_null=True)
    located_at = serializers.DateTimeField(allow_null=True)
    position = PositionSerializer(allow_null=True)
    continuous = serializers.BooleanField(help_text="Also shares while the app is closed.")


class PartnerLocationSerializer(serializers.Serializer[dict[str, object]]):
    sharing = serializers.BooleanField()
    continuous = serializers.BooleanField()
    city = CitySerializer(allow_null=True, help_text="Only when both of you share.")
    position = PositionSerializer(
        allow_null=True, help_text="Last shared position, for the map. Only when both share."
    )


class DistanceSerializer(serializers.Serializer[dict[str, object]]):
    terms_version = serializers.IntegerField()
    mine = MyLocationSerializer()
    partner = PartnerLocationSerializer()
    km = serializers.IntegerField(
        allow_null=True, help_text="Rounded; 0 means less than 1 km. Null unless both share."
    )


class PositionInputSerializer(serializers.Serializer[dict[str, object]]):
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)


class ConsentInputSerializer(serializers.Serializer[dict[str, object]]):
    terms_version = serializers.IntegerField(min_value=1)


class ContinuousInputSerializer(serializers.Serializer[dict[str, object]]):
    enabled = serializers.BooleanField()
