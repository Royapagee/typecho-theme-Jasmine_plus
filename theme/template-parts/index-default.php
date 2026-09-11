<?php if (!defined('__TYPECHO_ROOT_DIR__')) exit; ?>

<article class="card border-0 py-3 col-12 block" itemscope="itemscope" itemtype="http://schema.org/Article">
    <?php
    $thumbVal = $this->fields->thumbnail;
    $images = [];
    if ($thumbVal == '1') {
        preg_match_all('/<img[^>]+src=["\']([^"\']+)["\'][^>]*>/i', $this->content, $matches);
        $images = array_slice($matches[1] ?? [], 0, 3);
    }
    ?>
    <?php if ($thumbVal == '1'): ?>
        <div class="card-body p-0 d-flex flex-column row-gap-1">
            <h3 class="card-title fs-5 fw-normal" itemprop="headline">
                <a href="<?php $this->permalink(); ?>"
                   title="<?php $this->title(); ?>"><?php $this->title(); ?></a>
            </h3>
            <p class="card-text mb-0">
                <small class="text-body-tertiary"><?php $this->date(); ?></small>
            </p>
            <?php if (!empty($images)): ?>
            <div class="thumbnail-grid mt-1">
                <?php foreach ($images as $img): ?>
                    <a href="<?php $this->permalink(); ?>" class="thumbnail-grid-item rounded border border-light-subtle"
                       style="background-image: url('<?php echo $img; ?>')" title="<?php $this->title(); ?>"></a>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </div>
    <?php else: ?>
        <div class="d-flex column-gap-2 overflow-hidden">
            <div class="card-body p-0 d-flex flex-column justify-content-between row-gap-1">
                <h3 class="card-title fs-5 fw-normal" itemprop="headline">
                    <a href="<?php $this->permalink(); ?>"
                       title="<?php $this->title(); ?>"><?php $this->title(); ?></a>
                </h3>
                <p class="card-text more text-body-secondary" itemprop="about"><?php $this->excerpt(70, '...'); ?></p>
                <p class="card-text">
                    <small class="text-body-tertiary"><?php $this->category(', '); ?> ·
                        <?php $this->date(); ?>
                    </small>
                </p>
            </div>
            <?php if ($thumbVal && $thumbVal != '0'): ?>
                <a href="<?php $this->permalink(); ?>"
                   class="rounded ms-auto border border-light-subtle thumbnail d-none d-lg-block"
                   title="<?php $this->title(); ?>"
                   style="background-image: url('<?php $this->fields->thumbnail(); ?>')"></a>
            <?php endif; ?>
        </div>
    <?php endif; ?>
    <meta itemprop="author" content="<?php $this->author(); ?>" />
    <meta itemprop="publisher" content="<?php $this->options->title(); ?>" />
    <meta itemprop="datePublished" content="<?php $this->date('Y-m-d\TH:i:sP'); ?>" />
    <meta itemprop="dateModified" content="<?php $this->date('Y-m-d\TH:i:sP'); ?>" />
    <?php if ($thumbVal && $thumbVal != '0' && $thumbVal != '1'): ?>
        <meta itemprop="image" content="<?php $this->fields->thumbnail(); ?>" />
    <?php elseif ($thumbVal == '1' && !empty($images)): ?>
        <meta itemprop="image" content="<?php echo $images[0]; ?>" />
    <?php endif; ?>
</article>
