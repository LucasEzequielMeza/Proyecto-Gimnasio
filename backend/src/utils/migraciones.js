import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const archivoActual = fileURLToPath(import.meta.url);
const directorioActual = path.dirname(archivoActual);
const raizProyecto = path.resolve(directorioActual, '../../../');

const directorioMigraciones = path.join(
    raizProyecto,
    'database',
    'migracion'
);

const versionBaseline = '000_initial_baseline';

const tablasIniciales = [
    'usuarios',
    'roles',
    'permisos',
    'usuario_roles',
    'rol_permisos'
];

function calcularChecksum(contenido) {
    return createHash('sha256')
        .update(contenido, 'utf8')
        .digest('hex');
}

async function verificarEsquemaInicial(cliente) {
    const resultado = await cliente.query(
        `SELECT
            to_regclass('public.usuarios') IS NOT NULL AS usuarios,
            to_regclass('public.roles') IS NOT NULL AS roles,
            to_regclass('public.permisos') IS NOT NULL AS permisos,
            to_regclass('public.usuario_roles') IS NOT NULL AS usuario_roles,
            to_regclass('public.rol_permisos') IS NOT NULL AS rol_permisos`
    );

    const faltantes = tablasIniciales.filter(
        (tabla) => !resultado.rows[0][tabla]
    );

    if (faltantes.length > 0) {
        throw new Error(
            `La base de datos no tiene el esquema inicial completo. ` +
            `Faltan las tablas: ${faltantes.join(', ')}. ` +
            'Inicializá la base con database/init.sql antes de iniciar el servidor.'
        );
    }
}

export async function verificarDirectorioMigraciones() {
    const archivos = await readdir(directorioMigraciones);

    console.log('Directorio de migraciones:', directorioMigraciones);
    console.log('Archivos encontrados:', archivos);

    return archivos;
}

export async function ejecutarMigraciones() {
    const archivos = (await readdir(directorioMigraciones))
        .filter((archivo) => archivo.endsWith('.sql'))
        .sort();

    const cliente = await pool.connect();
    let bloqueoAdquirido = false;

    try {
        await cliente.query(
            "SELECT pg_advisory_lock(hashtext('proyectogym_migraciones'))"
        );
        bloqueoAdquirido = true;

        await verificarEsquemaInicial(cliente);

        await cliente.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(100) PRIMARY KEY,
                descripcion VARCHAR(255) NOT NULL,
                aplicada_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                checksum VARCHAR(64)
            )
        `);

        await cliente.query(`
            ALTER TABLE schema_migrations
            ADD COLUMN IF NOT EXISTS checksum VARCHAR(64)
        `);

        const resultadoRegistros = await cliente.query(
            'SELECT version, checksum FROM schema_migrations'
        );

        const aplicadas = new Map(
            resultadoRegistros.rows.map((fila) => [
                fila.version,
                fila.checksum
            ])
        );

        if (!aplicadas.has(versionBaseline)) {
            await cliente.query(
                `INSERT INTO schema_migrations (
                    version, descripcion, checksum
                 )
                 VALUES ($1, $2, NULL)`,
                [
                    versionBaseline,
                    'Registro inicial de la estructura existente de ProyectoGym'
                ]
            );

            aplicadas.set(versionBaseline, null);
            console.log('Registro inicial de la base de datos verificado.');
        } else if (aplicadas.get(versionBaseline) !== null) {
            throw new Error(
                'El registro 000_initial_baseline no debería tener checksum.'
            );
        }

        const versionesDisponibles = new Set(
            archivos.map((archivo) => path.basename(archivo, '.sql'))
        );

        for (const version of aplicadas.keys()) {
            if (
                version !== versionBaseline &&
                !versionesDisponibles.has(version)
            ) {
                throw new Error(
                    `La migración ${version} está registrada en la base de datos, ` +
                    'pero no existe su archivo SQL en database/migracion.'
                );
            }
        }

        for (const archivo of archivos) {
            const version = path.basename(archivo, '.sql');

            if (version === versionBaseline) {
                throw new Error(
                    'No uses 000_initial_baseline como nombre de un archivo SQL.'
                );
            }

            const contenido = await readFile(
                path.join(directorioMigraciones, archivo),
                'utf8'
            );

            if (!contenido.trim()) {
                throw new Error(`La migración ${archivo} está vacía.`);
            }

            const checksum = calcularChecksum(contenido);

            if (aplicadas.has(version)) {
                if (aplicadas.get(version) !== checksum) {
                    throw new Error(
                        `La migración ${archivo} ya fue aplicada, ` +
                        'pero su contenido cambió.'
                    );
                }

                continue;
            }

            console.log(`Aplicando migración: ${archivo}`);

            await cliente.query('BEGIN');

            try {
                await cliente.query(contenido);

                await cliente.query(
                    `INSERT INTO schema_migrations (
                        version, descripcion, checksum
                     )
                     VALUES ($1, $2, $3)`,
                    [
                        version,
                        `Migración aplicada desde ${archivo}`,
                        checksum
                    ]
                );

                await cliente.query('COMMIT');
                aplicadas.set(version, checksum);

                console.log(`Migración aplicada: ${archivo}`);
            } catch (error) {
                try {
                    await cliente.query('ROLLBACK');
                } catch (errorRollback) {
                    console.error(
                        'Error al revertir la migración:',
                        errorRollback.message
                    );
                }

                throw error;
            }
        }

        console.log('Proceso de migraciones finalizado.');
    } finally {
        try {
            if (bloqueoAdquirido) {
                await cliente.query(
                    "SELECT pg_advisory_unlock(hashtext('proyectogym_migraciones'))"
                );
            }
        } finally {
            cliente.release();
        }
    }
}