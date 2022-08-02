import axios from 'axios';
import * as cheerio from 'cheerio';

export class CapitalCityScraper {
  async scrapeCity(url: string) {
    const response = await axios.get(url);
    const html = response.data;

    const $ = cheerio.load(html);
    const regChageSize = new RegExp("^https.*\/");

    const image = $("img[alt='What is an avatar in the Metaverse?']");
    if (image[0]?.attribs?.src) {
      let src = image[0]?.attribs?.src.replace(regChageSize, 'https://cdn-images-1.medium.com/max/1024/');
      console.log(src);
    }


  }
}

async function main() {
  const scraper = new CapitalCityScraper();
  await scraper.scrapeCity("https://medium.com/@LivelyVerse");
}

main();