/*
 * Spooned OSRS map tile renderer (docs/map-tiles.md). Built inside a checkout of RuneLite's `cache` module by
 * .github/workflows/map-tiles.yml and run against an OSRS game cache plus its XTEA keys.
 *
 * It uses RuneLite's MapImageDumper (BSD 2-Clause, https://github.com/runelite/runelite) to draw every map square
 * (region, 64 by 64 game tiles) on every plane on its own, at the dumper's 4 px per game tile: one 256 px image per
 * square, exactly a zoom 2 map tile. drawRegion also draws the objects of the neighbouring squares that reach into this
 * one, so the squares join up. Drawing square by square keeps memory small (the whole world as one image is over
 * 650 million pixels per plane).
 *
 * Output, in <outDir>: <plane>_<regionX>_<regionY>.png (transparent where the plane has nothing; squares with nothing
 * on a plane are skipped), render.json (counts and bounds), missing-keys.txt (squares whose objects could not be
 * decrypted: they show terrain only) and worldmaps.json: the game's own world maps (the in-game world map's dropdown:
 * Gielinor Surface, Misthalin Underground, ...). Each is read from the WORLDMAP index: its "details" file (name, origin,
 * whether it is the surface) and the "compositemap" file of the same name, which lists the map squares and the 8 by 8
 * tile zones the map is made of, each with its source in the game world, the display position it is drawn at, and its
 * floors (minLevel, levels). scripts/slice-map-tiles.mjs draws each map from these.
 *
 * Usage: SpoonedMapTiles <cacheDir> <xtea.json> <outDir> [icons|maps] (maps: only worldmaps.json)
 */
package net.runelite.cache;

import java.awt.image.BufferedImage;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import com.google.gson.GsonBuilder;
import net.runelite.cache.definitions.MapSquareDefinition;
import net.runelite.cache.definitions.WorldMapCompositeDefinition;
import net.runelite.cache.definitions.WorldMapDefinition;
import net.runelite.cache.definitions.ZoneDefinition;
import net.runelite.cache.definitions.loaders.WorldMapCompositeLoader;
import net.runelite.cache.definitions.loaders.WorldMapLoader;
import net.runelite.cache.fs.Archive;
import net.runelite.cache.fs.ArchiveFiles;
import net.runelite.cache.fs.FSFile;
import net.runelite.cache.fs.Storage;
import net.runelite.cache.util.Djb2;
import javax.imageio.ImageIO;
import net.runelite.cache.fs.Index;
import net.runelite.cache.fs.Store;
import net.runelite.cache.region.Region;
import net.runelite.cache.region.RegionLoader;
import net.runelite.cache.util.XteaKeyManager;

public class SpoonedMapTiles
{
	public static void main(String[] args) throws IOException
	{
		if (args.length < 3)
		{
			System.err.println("Usage: SpoonedMapTiles <cacheDir> <xtea.json> <outDir> [icons]");
			System.exit(2);
			return;
		}
		File cacheDir = new File(args[0]);
		File outDir = new File(args[2]);
		boolean icons = args.length > 3 && "icons".equals(args[3]);
		outDir.mkdirs();

		XteaKeyManager keys = new XteaKeyManager();
		try (InputStream in = new FileInputStream(args[1]))
		{
			keys.loadKeys(in);
		}

		long started = System.currentTimeMillis();
		try (Store store = new Store(cacheDir))
		{
			store.load();
			String worldMapsJson = worldMaps(store);
			Files.write(new File(outDir, "worldmaps.json").toPath(), worldMapsJson.getBytes(StandardCharsets.UTF_8));
			if (args.length > 3 && "maps".equals(args[3]))
			{
				return;
			}
			RegionLoader regionLoader = new RegionLoader(store, keys);
			MapImageDumper dumper = new MapImageDumper(store, regionLoader);
			// Terrain, walls and objects only: the site draws its own icons and labels over the tiles.
			dumper.setRenderIcons(icons);
			dumper.setRenderLabels(false);
			dumper.setLabelRegions(false);
			dumper.setOutlineRegions(false);
			// RGB, not the dumper's transparency mode: ground colours carry no alpha, so they would come out invisible.
			// The game never paints pure black (its colour code turns 0 into 1), so black is "nothing here" and becomes
			// transparent below.
			dumper.setTransparency(false);
			dumper.load();

			List<Region> regions = new ArrayList<>(regionLoader.getRegions());
			regions.sort(Comparator.comparingInt(Region::getRegionID));
			Index maps = store.getIndex(IndexType.MAPS);
			StringBuilder missing = new StringBuilder();
			int images = 0;
			int missingKeys = 0;
			int done = 0;
			for (Region region : regions)
			{
				int x = region.getRegionX();
				int y = region.getRegionY();
				if (maps.findArchiveByName("l" + x + "_" + y) != null && keys.getKey(region.getRegionID()) == null)
				{
					missing.append(region.getRegionID()).append(' ').append(x).append('_').append(y).append('\n');
					missingKeys++;
				}
				for (int plane = 0; plane < Region.Z; plane++)
				{
					BufferedImage image = withTransparency(dumper.drawRegion(region, plane));
					if (image == null)
					{
						continue;
					}
					ImageIO.write(image, "png", new File(outDir, plane + "_" + x + "_" + y + ".png"));
					images++;
				}
				if (++done % 250 == 0)
				{
					System.out.printf("%d of %d squares, %d images, %ds%n", done, regions.size(), images, (System.currentTimeMillis() - started) / 1000);
				}
			}

			Files.write(new File(outDir, "missing-keys.txt").toPath(), missing.toString().getBytes(StandardCharsets.UTF_8));
			String json = String.format("{\"squares\":%d,\"images\":%d,\"missingKeys\":%d,\"lowestX\":%d,\"lowestY\":%d,\"highestX\":%d,\"highestY\":%d,\"seconds\":%d}%n",
				regions.size(), images, missingKeys,
				regionLoader.getLowestX().getRegionX(), regionLoader.getLowestY().getRegionY(),
				regionLoader.getHighestX().getRegionX(), regionLoader.getHighestY().getRegionY(),
				(System.currentTimeMillis() - started) / 1000);
			Files.write(new File(outDir, "render.json").toPath(), json.getBytes(StandardCharsets.UTF_8));
			System.out.print(json);
		}
	}

	/**
	 * The game's world maps as JSON: [{id, key, name, surface, origin: [x, y, plane], squares: [[minLevel, levels,
	 * sourceSquareX, sourceSquareY, displaySquareX, displaySquareY], ...], zones: [[minLevel, levels, sourceSquareX,
	 * sourceSquareY, sourceZoneX, sourceZoneY, displaySquareX, displaySquareY, displayZoneX, displayZoneY], ...]}].
	 * A map's details and its composite share a name (the game looks the composite up by the details' internal name);
	 * an unnamed index pairs them by file id.
	 */
	static String worldMaps(Store store) throws IOException
	{
		Storage storage = store.getStorage();
		Index index = store.getIndex(IndexType.WORLDMAP);
		Archive detailsArchive = index.isNamed() ? index.findArchiveByName("details") : index.getArchive(WorldMapManager.DETAILS_ID);
		Archive compositeArchive = index.isNamed() ? index.findArchiveByName("compositemap") : index.getArchive(WorldMapManager.COMPOSITEMAP_ID);
		ArchiveFiles details = detailsArchive.getFiles(storage.loadArchive(detailsArchive));
		ArchiveFiles composites = compositeArchive.getFiles(storage.loadArchive(compositeArchive));
		Map<Integer, FSFile> byName = new HashMap<>();
		for (FSFile file : composites.getFiles())
		{
			byName.put(file.getNameHash(), file);
		}
		WorldMapLoader detailsLoader = new WorldMapLoader();
		WorldMapCompositeLoader compositeLoader = new WorldMapCompositeLoader().configureForRevision(index.getRevision());
		List<Map<String, Object>> out = new ArrayList<>();
		for (FSFile file : details.getFiles())
		{
			WorldMapDefinition def = detailsLoader.load(file.getContents(), file.getFileId());
			FSFile compositeFile = index.isNamed() ? byName.get(Djb2.hash(def.safeName.toLowerCase())) : composites.findFile(file.getFileId());
			if (compositeFile == null)
			{
				System.out.printf("world map %d %s: no composite%n", def.fileId, def.name);
				continue;
			}
			WorldMapCompositeDefinition composite = compositeLoader.load(compositeFile.getContents());
			List<int[]> squares = new ArrayList<>();
			for (MapSquareDefinition s : composite.getMapSquareDefinitions())
			{
				squares.add(new int[]{s.minLevel, s.levels, s.sourceSquareX, s.sourceSquareZ, s.displaySquareX, s.displaySquareZ});
			}
			List<int[]> zones = new ArrayList<>();
			for (ZoneDefinition z : composite.getZoneDefinitions())
			{
				zones.add(new int[]{z.minLevel, z.levels, z.sourceSquareX, z.sourceSquareZ, z.sourceZoneX, z.sourceZoneZ, z.displaySquareX, z.displaySquareZ, z.displayZoneX, z.displayZoneZ});
			}
			Comparator<int[]> order = (a, b) -> {
				for (int i = 0; i < a.length; i++)
				{
					if (a[i] != b[i])
					{
						return Integer.compare(a[i], b[i]);
					}
				}
				return 0;
			};
			squares.sort(order);
			zones.sort(order);
			Map<String, Object> map = new LinkedHashMap<>();
			map.put("id", def.fileId);
			map.put("key", def.safeName);
			map.put("name", def.name);
			map.put("surface", def.isSurface);
			map.put("origin", new int[]{def.position.getX(), def.position.getY(), def.position.getZ()});
			map.put("zoom", def.defaultZoom);
			map.put("background", def.backgroundColor);
			map.put("squares", squares);
			map.put("zones", zones);
			out.add(map);
			System.out.printf("world map %d %s (%s): %d squares, %d zones%n", def.fileId, def.name, def.safeName, squares.size(), zones.size());
		}
		out.sort(Comparator.comparingInt(m -> (Integer) m.get("id")));
		return new GsonBuilder().create().toJson(out);
	}

	/** The image with black (nothing drawn) made transparent, or null when nothing was drawn at all. */
	private static BufferedImage withTransparency(BufferedImage image)
	{
		BufferedImage out = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_ARGB);
		boolean drawn = false;
		for (int y = 0; y < image.getHeight(); y++)
		{
			for (int x = 0; x < image.getWidth(); x++)
			{
				int rgb = image.getRGB(x, y) & 0xFFFFFF;
				if (rgb != 0)
				{
					out.setRGB(x, y, 0xFF000000 | rgb);
					drawn = true;
				}
			}
		}
		return drawn ? out : null;
	}
}
