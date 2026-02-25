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
const MESSAGES_DIR = path.join(DATA_DIR, 'messages');

const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    console.log(`[${new Date().toISOString()}] ${method} ${pathname}`);

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
        if (method === 'POST' && pathname === '/api/update-field') {
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
        if (method === 'POST' && pathname === '/api/update-emr') {
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

        // 3. Delete EMR Config
        if (method === 'POST' && pathname === '/api/delete-emr') {
            const { position } = await getBody(req);
            console.log(`Deleting EMR config for: ${position}`);

            const content = await fs.readFile(EMR_CONFIG_PATH, 'utf-8');
            const data = JSON.parse(content);

            const index = data.entries.findIndex(e => e.fieldPosition === position);
            if (index !== -1) {
                const entry = data.entries[index];
                const imagePaths = entry.imagePaths || [];

                // Remove from JSON
                data.entries.splice(index, 1);
                await fs.writeFile(EMR_CONFIG_PATH, JSON.stringify(data, null, 2));

                // Cleanup images
                for (const imgPath of imagePaths) {
                    try {
                        if (imgPath.startsWith('/emr-images/')) {
                            const fullPath = path.join(IMAGES_DIR, path.basename(imgPath));
                            await fs.unlink(fullPath);
                            console.log(`Deleted image during EMR removal: ${fullPath}`);
                        }
                    } catch (e) {
                        console.error(`Failed to cleanup image ${imgPath}:`, e);
                    }
                }

                console.log(`Successfully deleted EMR config for ${position}`);
                return sendJSON({ success: true, message: `EMR config for ${position} removed` });
            }

            return sendJSON({ success: false, message: 'EMR entry not found' }, 404);
        }

        // 4. Get Library Inventory (3-Level Hierarchy)
        if (method === 'GET' && pathname === '/api/inventory') {
            console.log('Fetching hierarchical inventory...');
            try {
                const inventory = {};
                const directions = ['Inbound', 'Outbound'];

                for (const direction of directions) {
                    const dirPath = path.join(MESSAGES_DIR, direction);
                    inventory[direction] = {};

                    // Ensure direction folder exists
                    await fs.mkdir(dirPath, { recursive: true }).catch(() => { });

                    const types = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
                    for (const typeEnt of types) {
                        if (typeEnt.isDirectory()) {
                            const typeName = typeEnt.name;
                            const typePath = path.join(dirPath, typeName);
                            inventory[direction][typeName] = {};

                            const vendors = await fs.readdir(typePath, { withFileTypes: true }).catch(() => []);
                            for (const vendorEnt of vendors) {
                                if (vendorEnt.isDirectory()) {
                                    const vendorName = vendorEnt.name;
                                    const vendorPath = path.join(typePath, vendorName);

                                    const files = await fs.readdir(vendorPath);
                                    inventory[direction][typeName][vendorName] = files
                                        .filter(f => f.endsWith('.hl7'))
                                        .map(f => f.replace('.hl7', ''))
                                        .sort();
                                }
                            }
                        }
                    }
                }

                return sendJSON({ success: true, inventory, serverVersion: '2026-02-25.03 (HierarchFix)' });
            } catch (err) {
                console.error('Failed to read hierarchical inventory:', err);
                return sendJSON({ success: false, message: 'Could not read message library', error: err.message }, 500);
            }
        }

        // 5. Save HL7 Message to Library (Nested)
        if (method === 'POST' && pathname === '/api/save-message') {
            const { direction, type, vendor, label, content } = await getBody(req);
            const targetDirection = direction || 'Inbound';
            const targetVendor = vendor || 'Default';

            console.log(`Saving message: ${targetDirection}/${type}/${targetVendor} (${label})`);

            if (!type || !content) {
                return sendJSON({ success: false, message: 'Type and Content are required' }, 400);
            }

            // Sanitize label or default to timestamp
            const safeLabel = (label || '').trim().replace(/[^a-z0-9 _-]/gi, '') || `Imported ${new Date().toLocaleDateString().replace(/\//g, '-')}`;

            const vendorDir = path.join(MESSAGES_DIR, targetDirection, type, targetVendor);
            const filePath = path.join(vendorDir, `${safeLabel}.hl7`);

            try {
                await fs.mkdir(vendorDir, { recursive: true });
                await fs.writeFile(filePath, content, 'utf-8');
                console.log(`Successfully saved ${filePath}`);
                return sendJSON({ success: true, message: `Message saved to ${targetDirection}/${type}/${targetVendor}` });
            } catch (err) {
                console.error(`Failed to save message to ${filePath}:`, err);
                return sendJSON({ success: false, message: 'Failed to save message', error: err.message }, 500);
            }
        }

        // 6. Get Specific HL7 Content (Nested)
        if (method === 'POST' && pathname === '/api/get-hl7') {
            const body = await getBody(req).catch(e => ({}));
            const { direction, type, vendor, filename, label } = body;

            // Reconstruct path: direction/type/vendor/filename.hl7
            const targetFilename = filename || label;

            console.log(`Fetching HL7: ${direction}/${type}/${vendor} -> ${targetFilename}`);

            if (!direction || !type || !vendor || !targetFilename) {
                return sendJSON({ success: false, message: 'Missing path parameters (direction, type, vendor, filename)' }, 400);
            }

            const filePath = path.join(MESSAGES_DIR, direction, type, vendor, `${targetFilename}.hl7`);

            try {
                const content = await fs.readFile(filePath, 'utf-8');
                return sendJSON({ success: true, content });
            } catch (err) {
                console.error(`Failed to read HL7 ${filePath}:`, err);
                return sendJSON({ success: false, message: 'Message not found', error: err.message }, 404);
            }
        }

        // 7. Delete HL7 Message from Library (Nested)
        if (method === 'POST' && pathname === '/api/delete-message') {
            const body = await getBody(req).catch(e => ({}));
            const { direction, type, vendor, filename } = body;
            console.log(`Deleting HL7 message: ${direction}/${type}/${vendor} -> ${filename}`);

            if (!direction || !type || !vendor || !filename) {
                return sendJSON({ success: false, message: 'Missing path parameters' }, 400);
            }

            const filePath = path.join(MESSAGES_DIR, direction, type, vendor, `${filename}.hl7`);

            try {
                await fs.unlink(filePath);
                console.log(`Successfully deleted file: ${filePath}`);

                // Optional: Check if directory is empty and cleanup
                let currentDir = path.dirname(filePath);
                // Clean up vendor dir if empty
                const files = await fs.readdir(currentDir).catch(() => []);
                if (files.length === 0) {
                    await fs.rmdir(currentDir).catch(() => { });
                    console.log(`Cleaned up empty directory: ${currentDir}`);
                }

                return sendJSON({ success: true, message: `Message ${filename} deleted` });
            } catch (err) {
                console.error(`Failed to delete HL7 ${filePath}:`, err);
                return sendJSON({ success: false, message: 'File not found or could not be deleted', error: err.message }, 404);
            }
        }

        // 404 Catch-all
        console.warn(`[404] No handler for: ${method} "${pathname}"`);
        const availableRoutes = [
            'POST /api/update-field',
            'POST /api/update-emr',
            'POST /api/delete-emr',
            'GET /api/inventory',
            'POST /api/save-message',
            'POST /api/get-hl7',
            'POST /api/delete-message'
        ];
        sendJSON({
            success: false,
            message: `Endpoint Not Found: ${method} ${pathname}`,
            details: `Make sure the URL is exactly one of the supported routes.`,
            availableRoutes
        }, 404);

    } catch (err) {
        console.error('Server error:', err);
        sendJSON({ success: false, message: 'Internal Server Error', error: err.message }, 500);
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n================================================`);
    console.log(`Sidecar API server v2026-02-25.03`);
    console.log(`Running at: http://localhost:${PORT}`);
    console.log(`Network Access: http://192.168.1.126:${PORT}`);
    console.log(`------------------------------------------------`);
    console.log(`PATHS CONFIGURATION:`);
    console.log(`- Data Dir:    ${DATA_DIR}`);
    console.log(`- Messages:    ${MESSAGES_DIR}`);
    console.log(`- Images:      ${IMAGES_DIR}`);
    console.log(`- EMR Config:  ${EMR_CONFIG_PATH}`);
    console.log(`================================================\n`);
});
