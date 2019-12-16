const hrefReg = /\[.+\]\(\S+\)|<img src=(\S+).+\/>|!\[\]\(\S+\)|<\S+>/g;
const imageReg1 = /^<img src="(\S+)" .+\/>/;
const imageReg2 = /^!\[\]\((\S+)\)/;
const linkReg1 = /^\[.+\]\(\S+\)/;
const linkReg2 = /^<\S+>$/;

function getLinks(hrefs) {
  const hrefObj = {
    links: [],
    images: []
  };
  hrefs.forEach((href) => {
    if (href.search(linkReg1) >= 0 || href.search(linkReg2) >= 0) {
      hrefObj.links.push(href);
    } else {
      let imageSrcs = href.match(imageReg1);
      let imageSrcs1 = href.match(imageReg2);
      if (imageSrcs) {
        hrefObj.images.push(imageSrcs[1]);
      } else if (imageSrcs1) {
        hrefObj.images.push(imageSrcs1[1]);
      }
    }
  });
  return hrefObj;
}

function getPreviewContent(markdownContent) {
  let preview = '';
  let newMarkdownContent = markdownContent.replace(hrefReg, '');
  const newMarkdownLength = newMarkdownContent.length;
  for (let index = 0; index < newMarkdownLength; index++) {
    if (newMarkdownContent[index] === '#') {
      continue;
    } else if (newMarkdownContent[index] === '\n') {
      preview += ' ';
    } else {
      preview += newMarkdownContent[index];
    }
    if (preview.length === 50) {
      break;
    }
  }
  preview = preview.length === newMarkdownLength ? preview : `${preview}...`;
  const hrefs = markdownContent.match(hrefReg);
  if (hrefs) {
    const { images, links } = getLinks(hrefs);
    return { preview, images, links };
  }
  return { preview, images: [], links: [] };
}

export default getPreviewContent;
