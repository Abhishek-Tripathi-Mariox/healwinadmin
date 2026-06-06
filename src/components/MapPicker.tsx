import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";

// Fix default marker icon issue with webpack/vite
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface MapPickerProps {
  value?: { lat: number; lng: number; address?: string };
  onChange: (location: { lat: number; lng: number; address: string }) => void;
}

// Component to handle map click events
const MapClickHandler: React.FC<{
  onLocationSelect: (lat: number, lng: number) => void;
}> = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Component to recenter map when position changes
const RecenterMap: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
};

const MapPicker: React.FC<MapPickerProps> = ({ value, onChange }) => {
  const [position, setPosition] = useState<{ lat: number; lng: number }>({
    lat: value?.lat || 26.1445, // Default: Guwahati, Assam (NE India)
    lng: value?.lng || 91.7362,
  });
  const [address, setAddress] = useState(value?.address || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value?.lat && value?.lng) {
      setPosition({ lat: value.lat, lng: value.lng });
      setAddress(value.address || "");
    }
  }, [value?.lat, value?.lng, value?.address]);

  // Reverse geocode to get address from coordinates
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        { headers: { "Accept-Language": "en" } },
      );
      const data = await res.json();
      return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  // Search for locations
  const searchLocation = async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in`,
        { headers: { "Accept-Language": "en" } },
      );
      const data = await res.json();
      setSuggestions(data);
    } catch {
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  const handleSearchInput = (q: string) => {
    setSearchQuery(q);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchLocation(q), 400);
  };

  const handleLocationSelect = async (lat: number, lng: number) => {
    setPosition({ lat, lng });
    const addr = await reverseGeocode(lat, lng);
    setAddress(addr);
    onChange({ lat, lng, address: addr });
    setSuggestions([]);
    setSearchQuery("");
  };

  const handleSuggestionClick = (suggestion: any) => {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    setPosition({ lat, lng });
    setAddress(suggestion.display_name);
    onChange({ lat, lng, address: suggestion.display_name });
    setSuggestions([]);
    setSearchQuery("");
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        await handleLocationSelect(lat, lng);
      },
      () => alert("Unable to get your location. Please allow location access."),
    );
  };

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search location (e.g. Guwahati Medical College)"
            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleUseMyLocation}
            className="px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 whitespace-nowrap"
          >
            📍 My Location
          </button>
        </div>

        {/* Search Suggestions */}
        {suggestions.length > 0 && (
          <div className="absolute z-[1000] w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSuggestionClick(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-b-0"
              >
                {s.display_name}
              </button>
            ))}
          </div>
        )}
        {isSearching && (
          <div className="absolute z-[1000] w-full mt-1 bg-white border rounded-lg shadow-lg p-3 text-sm text-gray-500">
            Searching...
          </div>
        )}
      </div>

      {/* Map */}
      <div
        className="rounded-xl overflow-hidden border"
        style={{ height: "300px" }}
      >
        <MapContainer
          center={[position.lat, position.lng]}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[position.lat, position.lng]} />
          <MapClickHandler onLocationSelect={handleLocationSelect} />
          <RecenterMap lat={position.lat} lng={position.lng} />
        </MapContainer>
      </div>

      {/* Selected Address */}
      {address && (
        <div className="p-3 bg-gray-50 rounded-lg border">
          <p className="text-xs font-medium text-gray-500 mb-1">
            Selected Location:
          </p>
          <p className="text-sm text-gray-800">{address}</p>
          <p className="text-xs text-gray-400 mt-1">
            Coordinates: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
          </p>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Click on the map or search to set the location for this service.
      </p>
    </div>
  );
};

export default MapPicker;
