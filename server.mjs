import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3001;

// Base paths for data
const DATA_DIR = path.join(__dirname, 'src', 'data');
const DEFS_DIR = path.join(DATA_DIR, 'field-definitions');
const EMR_CONFIG_PATH = path.join(DATA_DIR, 'emr-config', 'configurable-fields.json');
const IMAGES_DIR = path.join(__dirname, 'public', 'emr-images');

const server = http.createServer(async (req, res) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    // Helper to send JSON response
    const sendJSON = (data, status = 200) => {
        res.writeHead(status, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify(data));
    };

    // Handle Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    // Helper to get request body
    const getBody = (req) => {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error('Invalid JSON body'));
                }
            });
            req.on('error', reject);
        });
    };

    try {
        // API Endpoints

        // 1. Update Field Definition
        if (req.method === 'POST' && req.url === '/api/update-field') {
            const body = await getBody(req);
            const { segment, fieldIndex, name, description } = body;
            const fIndex = parseInt(fieldIndex, 10);

            console.log(`Updating field: ${segment}.${fIndex}`);

            const filePath = path.join(DEFS_DIR, `${segment}.json`);

            // Check if file exists
            try {
                await fs.access(filePath);
            } catch (e) {
                console.error(`Segment file not found: ${filePath}`);
                return sendJSON({ success: false, message: `No definition file for segment ${segment}` }, 404);
            }

            console.log(`Loading file: ${filePath}`);
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);

            const field = data.fields.find(f => parseInt(f.field, 10) === fIndex);
            if (field) {
                field.name = name;
                field.description = description;
                await fs.writeFile(filePath, JSON.stringify(data, null, 2));
                console.log(`Successfully updated ${segment}.${fIndex}`);
                return sendJSON({ success: true, message: `Field ${segment}.${fIndex} updated` });
            }
            console.error(`Field index ${fIndex} not found in ${segment}`);
            return sendJSON({ success: false, message: 'Field not found' }, 404);
        }

        // 2. Update EMR Config (Metadata + Image)
        if (req.method === 'POST' && req.url === '/api/update-emr') {
            const body = await getBody(req).catch(e => { throw e; });
            const { position, emrLocation, notes, imagePaths, fieldName } = body;
            console.log(`Updating EMR config for: ${position}`);

            console.log(`Loading EMR config from: ${EMR_CONFIG_PATH}`);
            const content = await fs.readFile(EMR_CONFIG_PATH, 'utf-8');
            const data = JSON.parse(content);

            let entry = data.entries.find(e => e.fieldPosition === position);

            // Track old images for potential cleanup
            const oldImagePaths = entry ? [...(entry.imagePaths || [])] : [];

            // Process images. imagePaths will contain a mix of existing paths and new data URLs
            const finalImagePaths = [];

            if (Array.isArray(imagePaths)) {
                for (let i = 0; i < imagePaths.length; i++) {
                    const img = imagePaths[i];
                    if (img.startsWith('data:image/')) {
                        console.log(`Processing image ${i + 1} as base64...`);
                        const matches = img.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
                        if (matches && matches.length === 3) {
                            const extension = matches[1].split('/')[1] || 'png';
                            const base64Data = matches[2];
                            const fileName = `${position.replace(/\./g, '_')}_${Date.now()}_${i}.${extension}`;
                            const fullPath = path.join(IMAGES_DIR, fileName);

                            await fs.mkdir(IMAGES_DIR, { recursive: true });
                            await fs.writeFile(fullPath, base64Data, 'base64');
                            finalImagePaths.push(`/emr-images/${fileName}`);
                            console.log(`Image saved to: ${fullPath}`);
                        }
                    } else {
                        // Existing path
                        finalImagePaths.push(img);
                    }
                }
            }

            if (!entry) {
                console.log(`Creating NEW EMR entry for ${position}`);
                entry = {
                    fieldPosition: position,
                    fieldName: fieldName || position,
                    emrLocation: emrLocation || '',
                    imagePaths: finalImagePaths,
                    notes: notes || ''
                };
                data.entries.push(entry);
            } else {
                console.log(`Updating existing EMR entry for ${position}`);
                entry.emrLocation = emrLocation;
                entry.notes = notes;
                entry.imagePaths = finalImagePaths;
                if (fieldName) entry.fieldName = fieldName;
            }

            // Save the updated configuration
            await fs.writeFile(EMR_CONFIG_PATH, JSON.stringify(data, null, 2));
            console.log(`Successfully updated EMR config for ${position}`);

            // Cleanup orphaned image files
            const orphanedImages = oldImagePaths.filter(oldPath => !finalImagePaths.includes(oldPath));
            for (const orphanPath of orphanedImages) {
                try {
                    // Safety check: Ensure path starts with /emr-images/
                    if (orphanPath.startsWith('/emr-images/')) {
                        const fileName = path.basename(orphanPath);
                        const fullPath = path.join(IMAGES_DIR, fileName);
                        await fs.unlink(fullPath);
                        console.log(`Deleted orphaned image: ${fullPath}`);
                    }
                } catch (err) {
                    console.error(`Failed to delete orphaned image ${orphanPath}:`, err);
                }
            }

            return sendJSON({ success: true, message: `EMR config for ${position} updated`, data: entry });
        }

        // 404
        console.warn(`No handler for ${req.method} ${req.url}`);
        sendJSON({ success: false, message: 'Not Found' }, 404);

    } catch (err) {
        console.error('Server error:', err);
        sendJSON({ success: false, message: 'Internal Server Error', error: err.message }, 500);
    }
});

server.listen(PORT, () => {
    console.log(`Sidecar API server running at http://localhost:${PORT}`);
    console.log(`- Data directory: ${DATA_DIR}`);
});
