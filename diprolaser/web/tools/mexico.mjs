// Contorno de México (Natural Earth 1:50m vía world-atlas, dominio público) proyectado a SVG.
import fs from 'node:fs';
import { feature } from 'topojson-client';
import { geoConicConformal, geoPath } from 'd3-geo';
const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json'));
const mx = feature(topo, topo.objects.countries).features.find((f) => f.id === '484');
const W = 1000, H = 660;
const proj = geoConicConformal().parallels([17.5, 29.5]).rotate([102, 0]).fitExtent([[20, 20], [W - 20, H - 20]], mx);
const path = geoPath(proj).digits(1);
const d = path(mx);
const pt = (lon, lat) => proj([lon, lat]).map((v) => +v.toFixed(1));
// Destinos ilustrativos repartidos por el país (sin nombres en la página: solo "Envíos a todo México")
const dest = [[-117.04, 32.51], [-110.95, 29.07], [-106.09, 28.63], [-100.31, 25.67], [-97.5, 25.87], [-104.66, 24.02], [-107.39, 24.8], [-110.31, 24.14], [-103.35, 20.66], [-101.68, 21.12], [-99.13, 19.43], [-98.2, 19.04], [-96.13, 19.17], [-96.72, 17.06], [-93.12, 16.75], [-92.93, 17.99], [-89.62, 20.97], [-86.85, 21.16], [-99.89, 16.85], [-101.19, 19.7], [-100.98, 22.15], [-97.86, 22.25], [-102.57, 22.77], [-103.73, 19.24], [-115.45, 32.62]];
const out = { viewBox: `0 0 ${W} ${H}`, d, ags: pt(-102.2916, 21.8853), dest: dest.map(([a, b]) => pt(a, b)) };
fs.writeFileSync('src/data/mexico.json', JSON.stringify(out));
console.log('path chars', d.length, 'ags', out.ags);
