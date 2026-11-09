from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from core.auth import current_user
from core.permissions import HasActiveCouple, request_couple

from . import cities, services
from .serializers import CitySerializer, DistanceInputSerializer, DistanceSerializer


class CitySearchView(APIView):
    """Offline city search: nothing is sent to a third-party geocoder."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    @extend_schema(
        parameters=[OpenApiParameter("q", str, required=True)],
        responses={200: CitySerializer(many=True)},
    )
    def get(self, request: Request) -> Response:
        query = request.query_params.get("q", "")[:60]
        results = [
            {"id": city.id, "name": label, "country": city.country}
            for city, label in cities.search(query)
        ]
        return Response(results)


class DistanceView(APIView):
    """How far apart you are, city to city, only if both of you choose to share."""

    permission_classes = [IsAuthenticated, HasActiveCouple]

    def _payload(self, request: Request) -> Response:
        couple = request_couple(request)
        assert couple is not None  # noqa: S101 - HasActiveCouple
        data = services.overview(current_user(request), couple)
        return Response(DistanceSerializer(data).data)

    @extend_schema(responses={200: DistanceSerializer})
    def get(self, request: Request) -> Response:
        return self._payload(request)

    @extend_schema(request=DistanceInputSerializer, responses={200: DistanceSerializer})
    def put(self, request: Request) -> Response:
        payload = DistanceInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        couple = request_couple(request)
        assert couple is not None  # noqa: S101 - HasActiveCouple
        try:
            services.set_home(
                current_user(request),
                couple,
                data["city_id"],
                data.get("name"),
                data["sharing"],
            )
        except services.UnknownCity as exc:
            raise ValidationError({"city_id": "unknown_city"}) from exc
        return self._payload(request)
