/**
 * Reading a face at the door.
 *
 * Everything here runs in the tablet's own browser. A frame from the camera
 * goes through three models — one finds a face, one finds its landmarks so the
 * face can be squared up, one turns the squared-up face into 128 numbers — and
 * those numbers are compared against the descriptors the school enrolled. No
 * image leaves the tablet and none is stored anywhere: the database holds only
 * the numbers, which cannot be turned back into a picture.
 *
 * The library and its seven megabytes of weights are imported dynamically and
 * excluded from the service worker's precache, so they are downloaded the first
 * time the gate screen is opened on that device and never by anybody else. On a
 * door tablet that is a one-off; on a student's phone it never happens.
 */

/** face-api's own type, kept loose so the library is never imported eagerly. */
type FaceApi = typeof import('@vladmandic/face-api');

let api: FaceApi | null = null;
let loading: Promise<FaceApi> | null = null;

/**
 * How different two faces may be and still count as the same person.
 *
 * face-api's own examples use 0.6. This is deliberately tighter. At a school
 * door the two failure modes are not equal: a face the model is unsure about is
 * refused and the child shows their card instead, which costs ten seconds —
 * while a wrong match marks the wrong child present, tells the wrong parent
 * their son arrived, and nobody finds out. Brothers at the same school make
 * that a real risk, not a theoretical one.
 */
export const MATCH_THRESHOLD = 0.45;

/** Below this the detector is looking at a blur, a poster, or the back of a head. */
const MIN_CONFIDENCE = 0.5;

/**
 * Load the library and the three models. Safe to call repeatedly — the first
 * call does the work and the rest wait on it.
 */
export async function loadFaceEngine(onProgress?: (message: string) => void): Promise<FaceApi> {
    if (api) return api;
    if (loading) return loading;

    loading = (async () => {
        onProgress?.('جاري تحميل محرك التعرف...');
        const faceapi = await import('@vladmandic/face-api');

        onProgress?.('جاري تحميل النماذج...');
        const url = '/models/face';
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(url),
            faceapi.nets.faceLandmark68Net.loadFromUri(url),
            faceapi.nets.faceRecognitionNet.loadFromUri(url),
        ]);

        api = faceapi;
        return faceapi;
    })();

    try {
        return await loading;
    } catch (err) {
        // A failed load must not poison every later attempt.
        loading = null;
        throw err;
    }
}

/** True once the models are in memory; the screen uses it to hide its spinner. */
export function faceEngineReady(): boolean {
    return api !== null;
}

/**
 * The single face in front of the camera, as 128 numbers.
 *
 * Returns null when there is no face, when the detector is not confident, and —
 * importantly — when there is more than one. Two children leaning into the
 * frame together is the moment a door most wants to refuse to guess.
 */
export async function describeFace(
    video: HTMLVideoElement
): Promise<{ descriptor: number[]; box: { x: number; y: number; width: number; height: number } } | null> {
    if (!api) return null;
    if (video.readyState < 2 || video.videoWidth === 0) return null;

    const options = new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: MIN_CONFIDENCE });

    const results = await api
        .detectAllFaces(video, options)
        .withFaceLandmarks()
        .withFaceDescriptors();

    if (results.length !== 1) return null;

    const [face] = results;
    return {
        descriptor: Array.from(face.descriptor),
        box: {
            x: face.detection.box.x,
            y: face.detection.box.y,
            width: face.detection.box.width,
            height: face.detection.box.height,
        },
    };
}

export interface FaceProfile {
    student_id: string;
    name: string;
    uid: string;
    class_name?: string;
    descriptors: number[][];
}

export interface FaceMatch {
    profile: FaceProfile;
    distance: number;
}

/** Plain euclidean distance; the descriptors are already normalised. */
function distance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const d = a[i] - b[i];
        sum += d * d;
    }
    return Math.sqrt(sum);
}

/**
 * The closest enrolled student, if any is close enough.
 *
 * The runner-up matters as much as the winner: if the second-best face is
 * almost as close as the best, the model is not distinguishing between two
 * people — two brothers, most likely — and the honest answer is to refuse and
 * let the card decide.
 */
export function matchFace(descriptor: number[], profiles: FaceProfile[]): FaceMatch | null {
    let best: FaceMatch | null = null;
    let runnerUp = Infinity;

    for (const profile of profiles) {
        let closest = Infinity;
        for (const known of profile.descriptors || []) {
            if (known.length !== descriptor.length) continue;
            closest = Math.min(closest, distance(descriptor, known));
        }

        if (closest < (best?.distance ?? Infinity)) {
            runnerUp = best?.distance ?? runnerUp;
            best = { profile, distance: closest };
        } else if (closest < runnerUp) {
            runnerUp = closest;
        }
    }

    if (!best || best.distance > MATCH_THRESHOLD) return null;

    // Two candidates within 0.06 of each other is not a match, it is a guess.
    if (runnerUp - best.distance < 0.06) return null;

    return best;
}
