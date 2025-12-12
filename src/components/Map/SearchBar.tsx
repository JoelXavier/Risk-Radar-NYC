import { useState, useRef, useEffect } from 'react';
import { Search, X, MapPin } from 'lucide-react';
import styles from './SearchBar.module.css';

interface SearchBarProps {
    onLocationSelect: (lng: number, lat: number) => void;
}

export default function SearchBar({ onLocationSelect }: SearchBarProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);

        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        if (val.length > 2) {
            setLoading(true);
            searchTimeout.current = setTimeout(async () => {
                try {
                    // Use NYC Planning Labs GeoSearch API
                    const res = await fetch(`https://geosearch.planninglabs.nyc/v2/autocomplete?text=${encodeURIComponent(val)}`);
                    const data = await res.json();
                    if (data.features) {
                        setResults(data.features);
                    }
                } catch (err) {
                    console.error("Search failed", err);
                } finally {
                    setLoading(false);
                }
            }, 300);
        } else {
            setResults([]);
            setLoading(false);
        }
    };

    const handleSelect = (feature: any) => {
        const [lng, lat] = feature.geometry.coordinates;
        onLocationSelect(lng, lat);
        setQuery(feature.properties.label);
        setResults([]);
    };

    return (
        <div className={styles.searchContainer}>
            <div className={styles.inputWrapper}>
                <Search className={styles.searchIcon} size={18} />
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search NYC Address..."
                    value={query}
                    onChange={handleSearch}
                />
                {query && (
                    <button onClick={() => { setQuery(''); setResults([]); }} className={styles.clearBtn}>
                        <X size={16} />
                    </button>
                )}
            </div>

            {results.length > 0 && (
                <div className={styles.resultsDropdown}>
                    {results.map((item) => (
                        <div
                            key={item.properties.id}
                            className={styles.resultItem}
                            onClick={() => handleSelect(item)}
                        >
                            <MapPin size={14} className={styles.resultIcon} />
                            <div className={styles.resultText}>
                                <span className={styles.resultLabel}>{item.properties.label}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
