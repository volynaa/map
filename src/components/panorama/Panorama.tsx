import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import './Panorama.css'
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";

interface PanoramaProps {
    isOpen: boolean;
    onClose: () => void;
    panoramaUrl?: string;
    currentPosition?: {lng: number, lat: number}
}

interface GeoJSONLineFeature {
    id: number;
    type: string;
    geometry: {
        type: string;
        coordinates: number[][];
    };
    properties: {
        roadid: string;
        road_code: number;
        km_beg: number;
        km_end: number;
    };
}

interface GeoJSONPolygonFeature {
    id: number;
    type: string;
    geometry: {
        type: string;
        coordinates: number[][][];
    };
    properties: {
        roadid: string;
        road_code: number;
        km_beg: number;
        name: string;
        width: number;
    };
}

interface LineGeoJSONData {
    type: string;
    features: GeoJSONLineFeature[];
}

interface PolygonGeoJSONData {
    type: string;
    features: GeoJSONPolygonFeature[];
}

const Panorama: React.FC<PanoramaProps> = ({
       isOpen,
       onClose,
       panoramaUrl = '/data/panorama.jpg',
       currentPosition = {lng: 38.97349, lat: 45.02956}
                                           }) => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sphereRef = useRef<THREE.Mesh | null>(null);
    const animationRef = useRef<number>(0);
    const controlsRef = useRef<OrbitControls | null>(null);

    const lineDataRef = useRef<THREE.Line[]>([]);
    const polygonDataRef = useRef<THREE.Mesh[]>([]);
    const allLineDataRef = useRef<GeoJSONLineFeature[]>([]);
    const allPolygonDataRef = useRef<GeoJSONPolygonFeature[]>([]);

    const calculateDistance = useCallback((lng1: number, lat1: number, lng2: number, lat2: number): number => {
        const R = 6371000; // Радиус Земли в метрах
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }, []);

    const geoToMercator = useCallback((lng: number, lat: number, alt: number, referenceLng: number = 38.97349, referenceLat: number = 45.02956): THREE.Vector3 => {
        const earthRadius = 6371000;

        const x = (lng - referenceLng) * (Math.PI / 180) * earthRadius;
        const y = (lat - referenceLat) * (Math.PI / 180) * earthRadius;
        const z = alt - 31.4;

        return new THREE.Vector3(x, y, z);
    }, []);

    const isPointInRadius = useCallback((lng: number, lat: number, referenceLng: number, referenceLat: number): boolean => {
        const distance = calculateDistance(lng, lat, referenceLng, referenceLat);
        return distance <= 50;
    }, [calculateDistance]);

    const isLineInRadius = useCallback((coordinates: number[][], referenceLng: number, referenceLat: number): boolean => {
        for (const coord of coordinates) {
            const [lng, lat] = coord;
            if (isPointInRadius(lng, lat, referenceLng, referenceLat)) {
                return true;
            }
        }
        return false;
    }, [isPointInRadius]);

    const isPolygonInRadius = useCallback((coordinates: number[][][], referenceLng: number, referenceLat: number): boolean => {
        for (const ring of coordinates) {
            for (const coord of ring) {
                const [lng, lat] = coord;
                if (isPointInRadius(lng, lat, referenceLng, referenceLat)) {
                    return true;
                }
            }
        }
        return false;
    }, [isPointInRadius]);

    const updateVisibleGeoData = useCallback((referenceLng: number, referenceLat: number) => {
        lineDataRef.current.forEach(line => {
            sceneRef.current?.remove(line);
        });
        lineDataRef.current = [];

        polygonDataRef.current.forEach(polygon => {
            sceneRef.current?.remove(polygon);
        });
        polygonDataRef.current = [];

        allLineDataRef.current.forEach((feature, index) => {
            if (feature.geometry.type === 'LineString' &&
                isLineInRadius(feature.geometry.coordinates, referenceLng, referenceLat)) {

                const coordinates = feature.geometry.coordinates;
                const points: THREE.Vector3[] = [];

                coordinates.forEach(coord => {
                    const [lng, lat, alt] = coord;
                    const point = geoToMercator(lng, lat, alt, referenceLng , referenceLat);
                    points.push(point);
                });

                const geometry = new THREE.BufferGeometry().setFromPoints(points);

                const colors = [0xff0000, 0x00ff00];

                const material = new THREE.LineBasicMaterial({
                    color: colors[index],
                    transparent: true,
                    opacity: 0.9
                });

                const line = new THREE.Line(geometry, material);
                line.rotation.x = -Math.PI / 2 ;
                line.rotation.z = 0.15;
                line.position.y = -20;
                sceneRef.current?.add(line);
                lineDataRef.current.push(line);
            }
        });

        allPolygonDataRef.current.forEach((feature, index) => {
            if (feature.geometry.type === 'Polygon' &&
                isPolygonInRadius(feature.geometry.coordinates, referenceLng, referenceLat)) {

                const coordinates = feature.geometry.coordinates[0];
                const shape = new THREE.Shape();

                coordinates.forEach((coord, pointIndex) => {
                    const [lng, lat, alt] = coord;
                    const convertedPoint = geoToMercator(lng, lat, alt, referenceLng, referenceLat);

                    if (pointIndex === 0) {
                        shape.moveTo(convertedPoint.x, convertedPoint.y);
                    } else {
                        shape.lineTo(convertedPoint.x, convertedPoint.y);
                    }
                });

                const edges = new THREE.EdgesGeometry(new THREE.ShapeGeometry(shape));
                const line = new THREE.LineSegments(
                    edges,
                    new THREE.LineBasicMaterial({ color: 0xffffff})
                );
                line.rotation.x = -Math.PI / 2;
                line.rotation.z = 0.15;
                line.position.y = -20;
                const geometry = new THREE.ShapeGeometry(shape);

                const colors = [0x00ff00, 0xff00ff, 0xffff00, 0x00ffff, 0xff8800];

                const material = new THREE.MeshBasicMaterial({
                    color: colors[index % colors.length],
                    transparent: true,
                    opacity: 0.7,
                    side: THREE.DoubleSide
                });

                const mesh = new THREE.Mesh(geometry, material);
                mesh.rotation.x = -Math.PI / 2;
                mesh.rotation.z = 0.15;
                mesh.position.y = -20;
                sceneRef.current?.add(mesh);
                sceneRef.current?.add(line);

                polygonDataRef.current.push(mesh);
                polygonDataRef.current.push(line as THREE.Mesh);
            }
        });
    }, [geoToMercator, isLineInRadius, isPolygonInRadius]);

    const loadAllGeoData = useCallback(async () => {
        try {
            const lineResponse = await fetch('/data/line.json');
            const lineData: LineGeoJSONData = await lineResponse.json();
            allLineDataRef.current = lineData.features;

            const polygonResponse = await fetch('/data/road_cros.json');
            const polygonData: PolygonGeoJSONData = await polygonResponse.json();
            allPolygonDataRef.current = polygonData.features;

            updateVisibleGeoData(currentPosition.lng, currentPosition.lat);

        } catch (error) {
            console.error('Ошибка загрузки геоданных:', error);
        }
    }, [currentPosition, updateVisibleGeoData]);

    const startAnimation = useCallback(() => {
        if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

        const animate = () => {
            animationRef.current = requestAnimationFrame(animate);
            const control = controlsRef.current;
            if (control) {
                control.update();
            }
            rendererRef.current!.render(sceneRef.current!, cameraRef.current!);
        };

        animate();
    }, []);

    const initScene = useCallback( ()=> {
        if (!mountRef.current) return;

        const scene = new THREE.Scene();
        sceneRef.current = scene;
        const mount = mountRef.current;
        if(mount){
            const camera = new THREE.PerspectiveCamera(
                75,
                mount.clientWidth / mount.clientHeight,
                0.1,
                1000
            );
            cameraRef.current = camera;
            camera.position.set(0, 0, 50);

            const renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true
            });
            renderer.setSize(mount.clientWidth, mount.clientHeight);
            renderer.setPixelRatio(window.devicePixelRatio);
            mount.innerHTML = '';
            mount.appendChild(renderer.domElement);
            rendererRef.current = renderer;

            const controls = new OrbitControls(camera, renderer.domElement);
            controlsRef.current = controls;
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.rotateSpeed = 0.5;
            controls.zoomSpeed = 1.0;
            controls.panSpeed = 0.5;
            controls.minDistance = 10;
            controls.maxDistance = 100;

            const geometry = new THREE.SphereGeometry(500, 60, 40);
            geometry.scale(-1, 1, 1);
            const textureLoader = new THREE.TextureLoader();
            const texture = textureLoader.load(panoramaUrl, async () => {
                await loadAllGeoData();
                startAnimation();
            });

            texture.colorSpace = THREE.SRGBColorSpace;

            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8
            });

            const sphere = new THREE.Mesh(geometry, material);
            scene.add(sphere);
            sphereRef.current = sphere;
        }
    }, [panoramaUrl, loadAllGeoData, startAnimation]);

    useEffect(() => {
        if (!isOpen || !mountRef.current) return;

        initScene();

        const renderer = rendererRef.current;
        if (!renderer) return;

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            const render = rendererRef.current;
            if (render) {
                render.dispose();
            }

            lineDataRef.current.forEach(line => {
                sceneRef.current?.remove(line);
            });
            lineDataRef.current = [];

            polygonDataRef.current.forEach(polygon => {
                sceneRef.current?.remove(polygon);
            });
            polygonDataRef.current = [];
        };
    }, [isOpen, initScene]);

    function resetView() {
        const camera = cameraRef.current;
        const control = controlsRef.current;
        if (camera) {
            camera.fov = 75;
            camera.position.set(0, 0, 50);
            camera.updateProjectionMatrix();
        }
        if (control) {
            control.reset();
        }
    }

    function zoomIn() {
        const camera = cameraRef.current;
        if (camera) {
            camera.fov = Math.max(10, camera.fov - 10);
            camera.updateProjectionMatrix();
        }
    }

    function zoomOut(){
        const camera = cameraRef.current;
        if (camera) {
            camera.fov = Math.min(100, camera.fov + 10);
            camera.updateProjectionMatrix();
        }
    }

    if (!isOpen) return null;

    return (
        <div className="panorama-modal">
            <div className="panorama-header">
                <h3>Панорама местности</h3>
                <div className="panorama-controls">
                    <button onClick={resetView} className="control-btn" title="Сбросить вид">
                        Сброс
                    </button>
                    <button onClick={zoomIn} className="control-btn" title="Приблизить">
                        +
                    </button>
                    <button onClick={zoomOut} className="control-btn" title="Отдалить">
                        -
                    </button>
                    <button onClick={onClose} className="close-btn" title="Закрыть">
                        Закрыть
                    </button>
                </div>
            </div>
            <div
                ref={mountRef}
                className="panorama"
            />
        </div>
    );
};

export default Panorama;