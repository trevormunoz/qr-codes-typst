import { qrcode } from "qrcode";

async function ensureDirectoryExists(directory: string): Promise<void> {
  try {
    await Deno.stat(directory);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      await Deno.mkdir(directory, { recursive: true });
    } else {
      throw error;
    }
  }
}

async function clearDirectory(directory: string): Promise<void> {
  for await (const dirEntry of Deno.readDir(directory)) {
    if (dirEntry.isFile) {
      await Deno.remove(`${directory}/${dirEntry.name}`);
    }
  }
}

async function generateQRCode(data: string, filename: string): Promise<void> {
  const qrCodeBase64 = await qrcode(data, { size: 500 }); // What this seems to generate is a base64 string encoding a GIF image
  const unprefixedBase64 = qrCodeBase64.replace(/^data:image\/gif;base64,/, "");
  const imgArray = atob(unprefixedBase64);
  const binaryLength = unprefixedBase64.length;
  const bytes = new Uint8Array(binaryLength);

  for (let i = 0; i < binaryLength; i++) {
    bytes[i] = imgArray.charCodeAt(i);
  }
  await Deno.writeFile(filename, bytes);
  console.log(`QR code generated: ${filename}`);
}

async function createStickersSheet(count: number): Promise<void> {
  const imagesDirectory = "images";

  await ensureDirectoryExists(imagesDirectory);
  await clearDirectory(imagesDirectory);

  let typstContent = `
#let qr-sticker(uuid, qr-filename) = {
  align(center)[
    #box()[
      #image(qr-filename, fit: "cover")
      #v(2mm)
      #text(size: 12pt, uuid)
      #v(2mm)
    ]
  ]
}

#set page(width: 8.5in, height: 11in, margin: 0.5in)
#grid(
  columns: 2,
  rows: 2,
  gutter: 0.5in,
  `;
  for (let i = 0; i < count; i++) {
    const id = crypto.randomUUID();
    const qrFilename = `${imagesDirectory}/QR_${id}.gif`; // File name for the QR code
    await generateQRCode(id, qrFilename);
    typstContent += `qr-sticker("${id.slice(-6)}", "${qrFilename}"),\n`;
  }

  typstContent += ")";

  await Deno.writeTextFile("qr_codes_stickers.typ", typstContent);
  console.log("Typst file written to qr_codes_stickers.typ");

  // Compile Typst file to PDF (requires Typst to be installed)
  const command = new Deno.Command("typst", {
    args: ["compile", "qr_codes_stickers.typ", "qr_codes_stickers.pdf"],
    stdout: "piped",
    stderr: "piped",
  });

  try {
    const { success, stderr } = await command.output();
    if (success) {
      console.log("QR code stickers PDF generated successfully!");
    } else {
      console.error("Failed to compile Typst file to PDF.");
      console.error(new TextDecoder().decode(stderr));
    }
  } catch (error) {
    console.error("Error executing Typst command:", error);
  }
}

await createStickersSheet(24);
