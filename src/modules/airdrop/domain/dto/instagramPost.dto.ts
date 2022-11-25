export class InstagramPostDto {

  public static from(instagramPost: any): InstagramPostDto | null {
    if(instagramPost) {
      const dto = new InstagramPostDto();
      dto.id = instagramPost.node.id;
      dto.displayUrl = instagramPost.node.display_url;
      dto.mediaPreview = instagramPost.node.media_preview;
      dto.trackingToken = instagramPost.node.tracking_token;
      dto.isVideo = instagramPost.node.is_video;
      dto.text = instagramPost.node.edge_media_to_caption.edges[0].node.text;
      dto.shortcode = instagramPost.node.shortcode;
      dto.ownerId = instagramPost.node.owner.id;
      dto.ownerUsername = instagramPost.node.owner.username;
      dto.location = instagramPost.node.location;
      dto.thumbnailSrc = instagramPost.node.thumbnail_src;
      dto.hashtags = [...instagramPost.node.edge_media_to_caption.edges[0].node.text.matchAll(/#\b\w*\b/g)]
        .reduce((acc, match) => [...acc, match[0]], []);
      dto.createdAt = instagramPost.node.taken_at_timestamp;
      return dto;
    }
    return null;
  }

  id: string;
  displayUrl: string;
  mediaPreview: string;
  trackingToken: string;
  isVideo: boolean;
  text: string;
  shortcode: string;
  ownerId: string;
  ownerUsername: string;
  location: string;
  thumbnailSrc: string;
  hashtags: string[];
  createdAt: number;
}