import React, {useEffect, useRef, useState} from 'react';
import {Map, View, Overlay} from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Feature } from 'ol';
import Point from 'ol/geom/Point';
import { Style, Circle, Fill, Stroke } from 'ol/style';
import { fromLonLat, toLonLat } from 'ol/proj';
import GeoJSON from 'ol/format/GeoJSON';
import 'ol/ol.css';
import './Map.css'
import Help from "../UI/Help.tsx";
import Panorama from "../panorama/Panorama.tsx";
import type {FeatureLike} from "ol/Feature";

const AdvancedMap: React.FC = () => {
    const mapRef = useRef<HTMLDivElement | null>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    const [help, setHelp] = useState('');
    const [showPanorama, setShowPanorama] = useState(false);

    function getFeatureInfo(feature: FeatureLike, coordinate: number[]): string {
        const geometry = feature.getGeometry();

        if (!geometry) return '';

        let coordinates: number[] = [];

        if (geometry instanceof Point) {
            coordinates = geometry.getCoordinates();
        } else {
            coordinates = coordinate;
        }

        const lonLat = toLonLat(coordinates);
        const lon = lonLat[0].toFixed(6);
        const lat = lonLat[1].toFixed(6);

        return `Долгота: ${lon}<br>Широта: ${lat}`;
    }

    function getStyle(feature: Feature){
        const geometry = feature.getGeometry();

        if (!geometry) return new Style({});

        if (geometry instanceof Point) {
            return new Style({
                image: new Circle({
                    radius: 12,
                    fill: new Fill({ color: 'rgba(255, 0, 0, 0.5)' }),
                    stroke: new Stroke({ color: 'yellow', width: 3 })
                })
            });
        }

        return new Style({
            stroke: new Stroke({
                color: 'yellow',
                width: 6
            }),
            fill: new Fill({
                color: 'rgba(255, 255, 0, 0.3)'
            })
        });
    }

    const closePanorama = () => {
        setShowPanorama(false);
    };

    useEffect(() => {
        if (!mapRef.current || !tooltipRef.current) return;

        const tooltipOverlay = new Overlay({element: tooltipRef.current!});

        const hoverSource = new VectorSource();
        const hoverLayer = new VectorLayer({
            source: hoverSource,
            style: (feature) => getStyle(feature as Feature)
        });

        const semaphoresSource = new VectorSource({
            url: '/data/semaphores.json',
            format: new GeoJSON()
        });

        const semaphoresLayer = new VectorLayer({
            source: semaphoresSource,
            style: new Style({
                image: new Circle({
                    radius: 8,
                    fill: new Fill({ color: 'blue' }),
                    stroke: new Stroke({ color: 'white', width: 2 })
                })
            })
        });

        const lineSource = new VectorSource({
            url: '/data/line.json',
            format: new GeoJSON()
        });

        const lineLayer = new VectorLayer({
            source: lineSource,
            style: new Style({
                stroke: new Stroke({
                    color: 'green',
                    width: 3
                })
            })
        });

        const roadCrosSource = new VectorSource({
            url: '/data/road_cros.json',
            format: new GeoJSON()
        });

        const roadCrosLayer = new VectorLayer({
            source: roadCrosSource,
            style: new Style({
                stroke: new Stroke({
                    color: 'grey',
                    width: 3
                }),
                fill: new Fill({
                    color: 'rgba(128, 128, 128, 0.3)'
                })
            })
        });

        const map = new Map({
            target: mapRef.current!,
            layers: [
                new TileLayer({
                    source: new OSM()
                }),
                lineLayer,
                roadCrosLayer,
                semaphoresLayer,
                hoverLayer
            ],
            view: new View({
                center: fromLonLat([38.974021834,45.029457749,31.587090311]),
                zoom: 20
            }),
            overlays: [tooltipOverlay]
        });

        map.on('pointermove', event => {
            if (!tooltipRef.current) return;

            const pixel = event.pixel;
            const coordinate = event.coordinate;

            hoverSource.clear();

            const feature = map.forEachFeatureAtPixel(pixel, (feature) => feature);
            const tooltipElement = tooltipRef.current;
            if (feature) {
                const hoverFeature = new Feature({
                    ...feature.getProperties()
                });
                hoverSource.addFeature(hoverFeature);

                if(tooltipElement){
                    tooltipElement.innerHTML = getFeatureInfo(feature, coordinate);
                    tooltipOverlay.setPosition(coordinate);
                    tooltipElement.classList.add('visible');
                    map.getTargetElement().style.cursor = 'pointer';
                }
            } else {
                if(tooltipElement){
                    tooltipElement.classList.remove('visible');
                }
                map.getTargetElement().style.cursor = '';
            }
        });

        map.on('click', event => {
            const pixel = event.pixel;
            const feature = map.forEachFeatureAtPixel(pixel, (feature) => feature);

            if (feature) {
                const properties = feature.getProperties();

                if(properties){
                    const helpText = Object.entries(properties)
                        .filter(([key,,]) => key !== 'geometry')
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(';<br>');

                    setHelp(helpText);
                }
            } else {
                setHelp('');
            }
        });

        map.on('dblclick', event => {
            const pixel = event.pixel;
            const feature = map.forEachFeatureAtPixel(pixel, (feature) => feature);
            setHelp('');

            if (feature) {
                setShowPanorama(true);
            }
        });

        return () => map.setTarget();
    }, []);

    return (
        <div className="container-map">
            <div
                ref={mapRef}
                className="map"
            />
            <div
                ref={tooltipRef}
                className="tooltip"
            />
            <Help
                data={help}
            />
            <Panorama
                isOpen={showPanorama}
                onClose={closePanorama}
            />
        </div>
    );
};

export default AdvancedMap;
