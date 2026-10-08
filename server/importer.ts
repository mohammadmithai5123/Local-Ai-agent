import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
export const leadSchema = z.object({ name: z.string().trim().min(1).max(200), email: z.string().trim().email().max(254).transform(s => s.toLowerCase()), company: z.string().trim().max(300).default(''), city: z.string().trim().max(200).default(''), notes: z.string().trim().max(2000).default(''),country:z.string().trim().max(200).default(''),industry:z.string().trim().max(200).default('') });
export async function readFile(name: string, bytes: Buffer) {
    if (bytes.length > 2000000)
        throw Error('Maximum upload size is 2 MB.');
    let rows: string[][] = [];
    if (/\.csv$/i.test(name))
        rows = parse(bytes.toString('utf8').replace(/^\uFEFF/, ''), { bom: true, skip_empty_lines: true, relax_column_count: false, max_record_size: 20000 });
    else if (/\.xlsx$/i.test(name)) {
        // Reject oversized decompressed ZIP entries before handing the workbook to ExcelJS.
        let total = 0, entries = 0;
        for (let i = 0; i + 46 < bytes.length; i++)
            if (bytes.readUInt32LE(i) === 0x02014b50) {
                total += bytes.readUInt32LE(i + 24);
                entries++;
                if (total > 20000000 || entries > 1000)
                    throw Error('Workbook expands beyond the 20 MB safety limit.');
            }
        const book = new ExcelJS.Workbook();
        await book.xlsx.load(bytes as any);
        const sheet = book.worksheets[0];
        if (!sheet)
            throw Error('Workbook has no sheets.');
        if (sheet.rowCount > 1001 || sheet.columnCount > 50)
            throw Error('Maximum 1,000 rows and 50 columns.');
        sheet.eachRow({ includeEmpty: true }, row => { const cells: string[] = []; for (let i = 1; i <= sheet.columnCount; i++) {
            const v = row.getCell(i).value;
            cells.push(v === null ? '' : typeof v === 'object' ? ('formula' in v || 'sharedFormula' in v ? '[FORMULA BLOCKED]' : 'richText' in v ? v.richText.map(x => x.text).join('') : 'text' in v ? String(v.text) : String(v)) : String(v));
        } rows.push(cells); });
    }
    else
        throw Error('Choose a CSV or XLSX file.');
    if (rows.length < 2 || rows.length > 1001 || rows[0].length > 50)
        throw Error('Include a header and 1–1,000 data rows, at most 50 columns.');
    if (rows.some(r => r.some(c => c.length > 2000)))
        throw Error('A cell exceeds 2,000 characters.');
    return { headers: rows[0].map((s, i) => s.trim() || `Column ${i + 1}`), rows: rows.slice(1) };
}
export function mapRows(rows: string[][], mapping: Record<string, number>, existing: Set<string>) {
    const valid: z.infer<typeof leadSchema>[] = [], errors: {
        row: number;
        message: string;
    }[] = [];
    rows.forEach((row, i) => {
        try {
            const obj: any = {};
            for (const field of ['name', 'email', 'company', 'city', 'notes','country','industry']) {
                const n = mapping[field];
                obj[field] = Number.isInteger(n) && n >= 0 ? row[n] ?? '' : '';
            }
            if (Object.values(obj).some(v => typeof v === 'string' && (/^[=+@]/.test(v) || v === '[FORMULA BLOCKED]')))
                throw Error('Formula-like cells are blocked.');
            const lead = leadSchema.parse(obj);
            if (existing.has(lead.email))
                throw Error('Duplicate email (skipped).');
            existing.add(lead.email);
            valid.push(lead);
        }
        catch (e) {
            errors.push({ row: i + 2, message: e instanceof z.ZodError ? e.issues.map(x => `${x.path.join('.')}: ${x.message}`).join(';') : (e as Error).message });
        }
    });
    return { valid, errors };
}
